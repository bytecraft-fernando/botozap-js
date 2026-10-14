# Instagram — regras de mensagem, botão de comentário e métricas

As operações usam o UUID interno da Conta de canal do Instagram. O SDK continua
sendo um envelope fino da API: combinações de campos, limites e autorização são
validados pelo servidor. CLI e MCP preservam os erros estruturados 422
`invalid_request` e 404 `not_found`.

## Botão e entrega de Regra de comentário

`CreateCommentRuleParams`, `UpdateCommentRuleParams` e `CommentRule` incluem
`dm_button_title`, `delivery_text` e `delivery_media` (textos opcionais/anuláveis).
Os campos chegam por create/get/list/update. Ausência em PATCH preserva o valor;
`null` remove. Sem botão a abertura continua sendo texto simples (1000 bytes).
Com botão, a abertura aceita 640 caracteres e o título 20 caracteres;
`delivery_text` é obrigatório (1000 bytes), `delivery_media` é uma URL HTTPS
pública de imagem sem credenciais. O botão aparece no app do Instagram.

```ts
await boto.channelAccounts.createCommentRule(channelAccountId, {
  keyword: "boto", dm_text: "Toque para receber o link",
  dm_button_title: "Receber link", delivery_text: "Aqui está: https://botozap.com.br",
  delivery_media: "https://botozap.com.br/brand/v2/botozap-verificacao-og.png",
});
```

```sh
botozap channel-accounts comment-rules create "$CONTA" --dm-text "Toque para receber" \
  --dm-button-title "Receber link" --delivery-text "Aqui está: https://botozap.com.br" \
  --delivery-media "https://botozap.com.br/brand/v2/botozap-verificacao-og.png"
botozap channel-accounts comment-rules update "$CONTA" "$REGRA" \
  --clear-dm-button-title --clear-delivery-text --clear-delivery-media
botozap channel-accounts comment-rules create "$CONTA" --input comentario.json
botozap channel-accounts comment-rules update "$CONTA" "$REGRA" --input patch.json
```

Create/update também aceitam `--json` ou `--stdin`. Escolha uma fonte JSON ou
flags de campos; combinações são recusadas. MCP `create_comment_rule` e
`update_comment_rule` anunciam os mesmos campos; outputs de list/get/create/update
os preservam. Scopes: `comment-rules:read/write`.

## Regras de mensagem

SDK: `channelAccounts.listMessageRules(id, {page, per_page})`,
`getMessageRule(id, ruleId)`, `createMessageRule(id, body)`,
`updateMessageRule(id, ruleId, patch)` e `deleteMessageRule(id, ruleId)`.
List retorna `{data, meta}`; os demais métodos retiram o envelope `{data}`.
Exclusão retorna `{id, deleted:true}` e preserva Disparos e Eventos.

```ts
const rule = await boto.channelAccounts.createMessageRule(channelAccountId, {
  name: "Preço no direct", trigger: "keyword", keywords: ["preço", "valor"],
  excluded_keywords: ["não quero"],
  actions: [{ type: "message", message: { type: "text", text: "Qual produto você procura?" } }],
});
await boto.channelAccounts.updateMessageRule(channelAccountId, rule.id, { is_active: false });
```

Campos obrigatórios na criação: `name` (1–100 caracteres), `trigger` e `actions`.
Gatilhos: `keyword`, `story_reply`, `story_mention`, `share`, `ref`, `ad`.
`keywords` e `excluded_keywords` são listas de até 20 expressões de 60 caracteres,
apenas para `keyword`, que exige ao menos uma palavra. `story_contains`
(anulável, até 200 caracteres) só acompanha `story_reply`. `ref` (anulável,
1–64 letras/dígitos/underscore/hífen) só acompanha `ref`; ausente/null gera valor
no servidor. Use o valor retornado em `https://ig.me/m/SEU_USUARIO?ref=REF`.
`ad_id` (anulável, 1–32 dígitos) só acompanha `ad`.

`priority` aceita inteiros 0–1000 (padrão 100) e `is_active` tem padrão true.
A primeira regra que casa vence por prioridade crescente, depois criação/id.
PATCH preserva campos ausentes e valida o estado final; 409 `duplicate_ref`
indica ref repetido nessa Conta de canal.

`actions` aceita 1–5 entradas, no máximo uma por tipo:

| Tipo | Campos |
| --- | --- |
| `message` | `message:{type:"text",text,quick_replies?}`, `{type:"image"\|"video"\|"audio"\|"document",link,filename?}` ou `{type:"interactive",interactive}` |
| `agent` | exatamente um de `agent_id`/`router_id`, vinculado ao respondedor publicado na Conta de canal |
| `stage` | `stage_id` UUID ou null |
| `tags` | `add?`/`remove?` listas de até 20 etiquetas de 40 caracteres; ao menos uma etiqueta |
| `assign` | `user_id` UUID |

Mensagens fixas seguem as capacidades do Instagram: texto/quick replies,
mídia HTTPS e interactive button/generic; a API recusa formatos indisponíveis.
Automação não usa `HUMAN_AGENT`. O stream de Eventos (`BotoZapEvent.type`, texto
aberto) inclui `instagram.message_rule.failed` para falhas de automação.

```sh
botozap channel-accounts message-rules list "$CONTA" --page 1 --per-page 20
botozap channel-accounts message-rules get "$CONTA" "$REGRA"
botozap channel-accounts message-rules create "$CONTA" --input mensagem.json
botozap channel-accounts message-rules update "$CONTA" "$REGRA" --json '{"is_active":false}'
botozap channel-accounts message-rules delete "$CONTA" "$REGRA"
```

Create/update exigem uma fonte `--input`, `--json` ou `--stdin` com objeto JSON.
MCP: `list_message_rules`, `get_message_rule`, `create_message_rule`,
`update_message_rule`, `delete_message_rule`; usam `channel_account_id` e,
quando necessário, `rule_id`. Scopes: `message-rules:read/write`; sandbox
permitido. As tools pertencem ao catálogo completo e respeitam rotas OAuth.

## Métricas de comentário

```ts
const metrics = await boto.channelAccounts.getCommentRuleMetrics(channelAccountId, ruleId, {
  from: "2026-10-01T00:00:00-03:00", to: "2026-11-01T00:00:00-03:00",
});
```

```sh
botozap channel-accounts comment-rules metrics "$CONTA" "$REGRA" \
  --from "2026-10-01T00:00:00-03:00" --to "2026-11-01T00:00:00-03:00"
```

MCP: `get_comment_rule_metrics({channel_account_id, rule_id, from, to})`.
`from` e `to` são obrigatórios, ISO 8601 com fuso, com início anterior ao fim.
A resposta contém `rule_id`, `channel_account_id`, `from`, `to`, `totals` e
`posts` (cada post acrescenta `media_id`, anulável). Os contadores são
`comments_matched`, `dms_delivered`, `public_replies`, `dm_touches`,
`conversations_opened` e `touch_rate`. A taxa é uma razão, pode superar 1 e é
null sem DM entregue. Scope `comment-rules:read`; sandbox permitido.
