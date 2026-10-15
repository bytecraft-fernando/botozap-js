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
  # Validar ANTES do override usado para testar candidatos ainda não publicados.
  # Caso contrário, workspace:* pode ser mascarado pelo SDK local (#209).
  node "$GATE_ROOT/scripts/verify-package.mjs" \
    "$GATE_TARBALL_DIR/$package_name.tgz" \
    "$GATE_ROOT/packages/$package_name/package.json" \
    "$GATE_ROOT/packages/sdk/package.json"
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
  'import { BotoZap, type SendResult, type AiAgentConfig, type InstagramInteractivePayload, type UpdateMessengerProfileParams, type CreateMessageRuleParams, type CommentRuleMetrics, type InstagramCommentAi, type InstagramCommentAiRun, type InstagramCommentAiRepliedEvent } from "@botozap/sdk";' \
  'const boto = new BotoZap({ apiKey: "bz_sandbox_release_gate" });' \
  'export async function smoke(): Promise<SendResult> {' \
  '  return boto.messages.send({ to: "+5500000000001", text: "Olá 😀" });' \
  '}' \
  'const config: AiAgentConfig = { provider: "openai", system_prompt: "Atendimento" };' \
  'export const aiSmoke = () => boto.ai.agents.saveDraft({id:"agent",customer_id:"customer",name:"Agente",expected_revision:"9007199254740993",config});' \
  'const interactive: InstagramInteractivePayload = { type: "generic", elements: [{ title: "Produto", subtitle: "Disponível", buttons: [{ type: "postback", title: "Ver", payload: "produto" }] }] };' \
  'export const instagramSmoke = () => boto.messages.sendInteractive({ to: "17841400000000123", from: "channel", interactive, tag: "human_agent" });' \
  'const profilePatch: UpdateMessengerProfileParams = { ice_breakers: null, persistent_menu: [{ type: "web_url", title: "Loja", url: "https://example.com" }] };' \
  'export const profileSmoke = () => boto.channelAccounts.updateMessengerProfile("channel", profilePatch);' \
  'export const ruleSmoke = () => boto.channelAccounts.createCommentRule("channel", { dm_text: "Oi", keywords: ["preço"], excluded_keywords: [], reply_variations: [], next_post: true, dm_button_title: "Receber", delivery_text: "Aqui está", delivery_media: null });' \
  'const messageRule: CreateMessageRuleParams = { name: "Preço", trigger: "keyword", keywords: ["preço"], actions: [{type:"message",message:{type:"text",text:"Oi"}},{type:"agent",router_id:"router"},{type:"stage",stage_id:null},{type:"tags",add:["novo"]},{type:"assign",user_id:"user"}] };' \
  'export const messageRuleSmoke = () => boto.channelAccounts.createMessageRule("channel", messageRule);' \
  'export const metricsSmoke = (): Promise<CommentRuleMetrics> => boto.channelAccounts.getCommentRuleMetrics("channel", "rule", {from:"2026-10-01T00:00:00Z",to:"2026-11-01T00:00:00Z"});' \
  'export const commentAiSmoke = (): Promise<InstagramCommentAi> => boto.channelAccounts.getCommentAi("channel");' \
  'export const updateCommentAiSmoke = () => boto.channelAccounts.updateCommentAi("channel", {enabled:false,agent_id:null,daily_limit:50});' \
  'export const commentAiRunsSmoke = async (): Promise<InstagramCommentAiRun[]> => (await boto.channelAccounts.listCommentAiRuns("channel", {page:1,per_page:30})).data;' \
  'export const commentAiEventSmoke = (event: InstagramCommentAiRepliedEvent) => event.data.automation.execution_id;' \
  > index.ts
printf '%s\n' \
  '{ "compilerOptions": { "strict": true, "module": "nodenext", "moduleResolution": "nodenext", "target": "es2022", "noEmit": true } }' \
  > tsconfig.json
pnpm exec tsc -p tsconfig.json

./node_modules/.bin/botozap --version
./node_modules/.bin/botozap --help > /dev/null

cp "$GATE_ROOT/scripts/packed-tools-only.mjs" ./packed-tools-only.mjs
cp "$GATE_ROOT/packages/mcp/tests/fixtures/release-0.6.0-tools.json" ./release-0.6.0-tools.json
node ./packed-tools-only.mjs
