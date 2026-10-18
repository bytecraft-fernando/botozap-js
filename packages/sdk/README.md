# @botozap/sdk

SDK oficial da [BotoZap](https://botozap.com.br) para Node.js. Envie mensagens e gerencie clientes na WhatsApp Cloud API oficial, em modelo multi-tenant.

O core da plataforma é fechado. Este cliente é a camada pública sobre a API HTTP: um envelope fino, tipado, sem dependências de runtime.

## Status: preview `0.x`

- Versão `0.x`, **sem promessa de estabilidade de API**: métodos e tipos podem
  mudar entre minors até a `1.0`. Fixe a versão exata no seu `package.json`.
- A [API REST](https://botozap.com.br/docs) é a interface oficial e estável —
  se algo faltar ou quebrar no SDK, o fallback é sempre chamar
  `https://botozap.com.br/api/v1` direto (o SDK é um envelope fino sobre ela).
- Bugs e pedidos: [issues do monorepo](https://github.com/bytecraft-fernando/botozap-js/issues).
  Nunca inclua sua chave de API no relato.

## Sandbox

Uma chave de ambiente **sandbox** (`bz_sandbox_...`, criada em `/chaves`) testa o
fluxo completo sem credencial Meta, sem número real e sem custo: `POST /messages`
responde `201` com `sandbox: true` e `wamid.sandbox.<...>`, e os eventos
simulados percorrem o pipeline real (webhook assinado com retry). Números
mágicos: `+5500000000001` (sent→delivered→read, janela de 24h sempre aberta),
`+5500000000002` (falha `131026`), `+5500000000003` (delivered + resposta
inbound que abre a janela real). A chave sandbox só acessa `POST /messages`,
`GET /messages`, `GET /messages/:id` e `GET /events` — as demais rotas respondem
`403 sandbox_forbidden`.

## Garantias de entrega (leia antes de ir a produção)

Espelha [a documentação de confiabilidade](https://botozap.com.br/docs):

- **Webhooks são at-least-once**: duplicatas raras acontecem — deduplique pelo
  header `X-Idempotency-Key` do evento recebido.
- **Sem ordem global**: ordene pelo timestamp do evento, não pela chegada.
- **Envio não é exactly-once**: num erro ambíguo (ex.: timeout depois do envio
  aceito pela Meta), o SDK lança `BotoZapError` mas a mensagem PODE ter saído.
  Em produção, persista sua própria chave de idempotência → `wamid` antes de
  reenviar. Transmissões (broadcasts) são at-least-once por natureza.

## Instalação

```bash
pnpm add @botozap/sdk
```

Requer Node 20.19 ou superior.

## Início rápido

```ts
import { BotoZap } from "@botozap/sdk";

const boto = new BotoZap({ apiKey: process.env.BOTOZAP_KEY! });

const result = await boto.messages.send({
  to: "+5531988887777",
  text: "Seu pão tá saindo do forno",
});

console.log(result.wamid, result.status);
```

No Instagram o recibo traz `wamid: null`, `channel: "instagram"` e o `mid` da
Meta em `external_id`. Para correlacionar envios de qualquer canal, use
`result.external_id ?? result.wamid`.

A conta é derivada da chave de API. Você nunca passa um id de conta: o isolamento multi-tenant é garantido no servidor.

## Mensagens

```ts
// Texto
await boto.messages.send({ to: "+5531988887777", text: "Olá!" });

// Template aprovado
await boto.messages.sendTemplate({
  to: "+5531988887777",
  template: { name: "boas_vindas", language: { code: "pt_BR" } },
});

// Mídia por link (image, video, audio ou document)
await boto.messages.sendMedia({
  to: "+5531988887777",
  type: "image",
  link: "https://cdn.exemplo.com/pedido.jpg",
  caption: "Seu pedido ficou pronto",
});

// De um número específico (obrigatório se a conta tem mais de um)
await boto.messages.send({
  to: "+5531988887777",
  text: "Olá!",
  // Aceita o phone_number_id Meta ou o UUID interno retornado pelo SDK.
  from: "uuid-ou-phone_number_id",
});

// Responder sem combinar manualmente Contato e origem: no WhatsApp sai pelo
// Número da Conversa; no Instagram, pela Conta de canal (channel_account.id).
await boto.conversations.reply("uuid-da-conversa", {
  text: "Resposta do agente",
});

// Botões de resposta, lista ou botão de link (objeto interactive da Cloud API)
await boto.messages.sendInteractive({
  to: "+5531988887777",
  interactive: {
    type: "button",
    body: { text: "Confirma o horário?" },
    action: {
      buttons: [
        { type: "reply", reply: { id: "sim", title: "Sim" } },
        { type: "reply", reply: { id: "nao", title: "Não" } },
      ],
    },
  },
});

// Localização
await boto.messages.sendLocation({
  to: "+5531988887777",
  latitude: -3.119,
  longitude: -60.0217,
  name: "Loja Centro",
});

// Reação a uma mensagem RECEBIDA (UUID interno ou wamid, até 30 dias); "" retira
const r = await boto.messages.sendReaction({
  to: "+5531988887777",
  message_id: "wamid.HBgM...",
  emoji: "👍",
});
r.reaction?.action; // "react" | "unreact"

// Instagram: o mesmo endpoint, com o IGSID do contato em `to`. `from` aceita o
// id da conta na Meta ou o UUID da Conta de canal (channelAccounts.list).
const ig = await boto.messages.send({
  to: "17841400000000123",
  text: "Tenho estes horários no sábado:",
  // Opções de resposta: só Instagram, só com texto, até 13 (título ≤ 20).
  quick_replies: [
    { title: "9h", payload: "sabado_09" },
    { title: "10h30", payload: "sabado_1030" },
  ],
});
ig.wamid; // null
ig.external_id; // "aWdEZ...mlk" (mid)

// Listar na ordem real das mensagens (histórico importado incluído)
const page = await boto.messages.list({ sort: "event_at", limit: 50 });
page.data[0]?.source; // "api" | "app" | "history" | "broadcast"
```

Interactive, localização e reação são mensagens livres: exigem a janela de 24h
aberta. A API valida o `interactive` (limites da Cloud API) e recusa com `422
invalid_request`; reação recusa com `invalid_reaction`, `missing_reaction_target`,
`reaction_target_not_found`, `reaction_target_invalid` ou `reaction_target_expired`.
O cursor de `messages.list` vale só para o `sort` que o gerou.

`quick_replies` só existe no Instagram e só com texto, dentro da janela de 24h:
no WhatsApp a API recusa com `channel_not_supported`; acima de 13 opções,
`too_many_quick_replies`; título acima de 20 caracteres,
`quick_reply_title_too_long`; fora da janela, `quick_replies_window_closed`.
No Instagram não existe `caption` em mídia (`unsupported_caption`).

### Botões e cards no Instagram

```ts
await boto.messages.sendInteractive({
  to: "17841400000000123", from: contaInstagramId,
  interactive: { type: "button", body: { text: "Como posso ajudar?" }, action: { buttons: [
    { type: "web_url", title: "Ver loja", url: "https://exemplo.com" },
    { type: "postback", title: "Horários", payload: "horarios" },
  ] } },
}, { idempotencyKey: chaveDaIntencao });
await boto.messages.sendInteractive({
  to: "17841400000000123", from: contaInstagramId,
  interactive: { type: "generic", elements: [{
    title: "Produto", subtitle: "Disponível na loja",
    image_url: "https://exemplo.com/foto.jpg",
    default_action: { type: "web_url", url: "https://exemplo.com/produto" },
    buttons: [{ type: "postback", title: "Quero saber mais", payload: "produto" }],
  }] },
});
```

`button` aceita 1–3 botões e texto até 640 caracteres; `generic` aceita 1–10
cards com título (até 80 caracteres) e ao menos uma propriedade adicional.
Subtítulo: até 80 caracteres; até 3 botões por card. Botões usam título de até
20 caracteres e postback de até 1000 caracteres; links são HTTPS. A API valida
os limites (`422`). `tag: "human_agent"` é opcional e depende da flag e da
janela autorizada pela API. O recibo traz `wamid: null`, `external_id`,
`channel: "instagram"` e `type: "interactive"`. Os formatos WhatsApp
`button` com `reply`, `list` e `cta_url` continuam disponíveis.

## Contas de canal e Regras de comentário

```ts
// Números do WhatsApp e Contas do Instagram lado a lado
const { data: contas } = await boto.channelAccounts.list({ channel: "instagram" });
const conta = await boto.channelAccounts.get(contas[0]!.id); // UUID ou id na Meta
// Saúde da conexão do Instagram (o token nunca é exposto)
conta.instagram?.token_status; // "ok" | "expiring" | "expired" | "invalid" | "revoked" | "unknown"

// Conversas de uma origem específica
await boto.conversations.list({ channel: "instagram", channel_account_id: conta.id });

// Regras de comentário (comment-rules:read / comment-rules:write)
const regra = await boto.channelAccounts.createCommentRule(conta.id, {
  keyword: "preço",
  dm_text: "Oi! Te mandei os valores por aqui.",
  reply_text: "Te chamei no direct!",
});
await boto.channelAccounts.listCommentRules(conta.id);
await boto.channelAccounts.updateCommentRule(conta.id, regra.id, { is_active: false });
```

`keyword` vazia vale para qualquer comentário e `media_id` vazio para todos os
posts. Criar ou ativar exige plano com Regras de comentário (`422
plan_restricted`); a mesma palavra-chave no mesmo alvo é `409 duplicate_rule`.
`deleteCommentRule(conta.id, regra.id)` exclui e retorna `{ id, deleted: true }`.
`keywords` (até 20 expressões), `excluded_keywords` (até 20 exclusões),
`reply_variations` (até 10 respostas públicas) e `next_post` estão disponíveis
na criação, leitura e atualização. `keywords` prevalece sobre `keyword`, e
`reply_variations` sobre `reply_text`; `[]` limpa a lista. `next_post: true`
aguarda o próximo post e não deve ser combinado com `media_id` explícito.

Com `token_status` `expired`, `invalid` ou `revoked`, os envios pela conta
falham até reconectá-la em Canais. Mensagens do Instagram editadas pelo contato
trazem o conteúdo atualizado com `content.edited` (`{ count, at }`); as apagadas,
`revoked_at`. Os Eventos `instagram.message.edited` e `instagram.message.revoked`
chegam pelo webhook e por `events.list`.

### Perguntas e menu do Instagram

```ts
const perfil = await boto.channelAccounts.getMessengerProfile(conta.id);
await boto.channelAccounts.updateMessengerProfile(conta.id, {
  ice_breakers: [{ question: "Quais os horários?", payload: "horarios" }],
  persistent_menu: [{ type: "web_url", title: "Ver loja", url: "https://exemplo.com" }],
});
await boto.channelAccounts.updateMessengerProfile(conta.id, { ice_breakers: null });
await boto.channelAccounts.syncMessengerProfile(conta.id);
await boto.channelAccounts.deleteMessengerProfile(conta.id);
```

GET usa `messenger-profile:read`; PATCH, DELETE e sync usam
`messenger-profile:write`. Sem sandbox. PATCH preserva seções ausentes;
`null` ou `[]` remove a seção. Até 4 perguntas e 5 itens de menu (`postback`
ou `web_url`). Perguntas: 80 caracteres; títulos: 20; payloads: 1000; URLs
http/https: 2000. Os quatro métodos retornam o snapshot com
`channel_account_id`, `config`, `revision`, `sync_status`, `synced_at`,
`last_error_code` e `updated_at`. GET lê o espelho salvo; sync verifica/reaplica
explicitamente o desejado. Falhas de aplicação conservam a configuração para
retry; `profile_busy` e `profile_sync_unconfirmed` pedem reconciliar após um
minuto. Sync sem configuração salva retorna `profile_not_configured`.
Perguntas e menu são do plano pago e do teste: no Free, salvar conteúdo
(PATCH) ou reaplicar uma configuração com conteúdo (sync) responde
`403 plan_restricted`; remover seções e DELETE seguem livres.

## Clientes e templates

```ts
const { data: customers, meta } = await boto.customers.list({ per_page: 20 });
const customer = await boto.customers.get("uuid-do-cliente");

const { data: templates } = await boto.templates.list();
```

## Mídia

Para enviar por link, use `messages.sendMedia`. O SDK só envia o contrato ao
endpoint canônico; não baixa o arquivo no processo do cliente:

```ts
await boto.messages.sendMedia({
  to: "+5531988887777",
  type: "document",
  link: "https://cdn.exemplo.com/fatura.pdf",
  caption: "Fatura de agosto",
  filename: "fatura-agosto.pdf",
});
```

`caption` é aceito em `image`, `video` e `document`; `audio` aceita apenas o
link; `filename` é exclusivo de `document`.

Para fazer ingest de um arquivo, a BotoZap baixa da URL com guard SSRF e envia
à Cloud API:

```ts
const up = await boto.media.upload({
  source: "https://exemplo.com/foto.png",
  phone_number_id,
});
// up.target.media_id → usável no envio
```

Para uma mídia **recebida**, busque metadados e a URL de download pelo `media_id`
da Cloud API. A mídia é espelhada de forma assíncrona: se ainda não terminou, o
método lança `BotoZapError` com `code: "media_not_ready"` (202) e você retenta,
respeitando o `Retry-After`:

```ts
try {
  const media = await boto.media.get(mediaId);
  // media.download_url é uma URL assinada e efêmera — baixe direto (GET).
} catch (err) {
  if (err instanceof BotoZapError && err.code === "media_not_ready") {
    const wait = Number(err.headers?.["retry-after"] ?? 5);
    // aguarde `wait` segundos e tente de novo
  }
}
```

## Retornos e paginação

O SDK **desempacota o envelope `{ data }`** da API pra você:

- **Item** (`get`, `create`, `update`, `send` de broadcast…): devolve a entidade
  direto — `boto.customers.get(id)` resolve para `Customer`, não `{ data: Customer }`.
- **Lista**: devolve o objeto com os itens **e** a paginação — `{ data, paging }`
  (cursor) ou `{ data, meta }` (offset/página). Nunca só o array.
- **`messages.send` / `sendTemplate`**: essa rota responde o objeto direto (sem
  envelope), então você recebe `SendResult` cru.
- **`delete`**: responde `204` — retorno `void`.

Dois modelos de paginação, conforme a coleção:

```ts
// Cursor (contacts, conversations, webhooks, apiLogs, webhookDeliveries,
// broadcasts.listRecipients): params { limit, after, before }.
let page = await boto.contacts.list({ limit: 50 });
if (page.paging.next) {
  page = await boto.contacts.list({ limit: 50, after: page.paging.next });
}

// Offset/página (customers, templates, broadcasts, phoneNumbers,
// channelAccounts, users, conversations.listAssignments): params { page, per_page }.
const { data, meta } = await boto.templates.list({ page: 2, per_page: 20 });
console.log(meta.total_count, meta.total_pages);
```

## Tratamento de erro

Respostas fora de 2xx viram `BotoZapError`, com o `code` e a `message` do envelope da API.

```ts
import { BotoZap, BotoZapError } from "@botozap/sdk";

try {
  await boto.messages.send({ to: "+5531988887777", text: "Olá!" });
} catch (err) {
  if (err instanceof BotoZapError) {
    console.error(err.code, err.status, err.message);
  }
}
```

Quando houve resposta HTTP (`status > 0`), o erro expõe também `err.headers` (os headers da resposta). Útil num `429`, para ler `Retry-After` / `X-RateLimit-*` e decidir quando reenviar:

```ts
catch (err) {
  if (err instanceof BotoZapError && err.status === 429) {
    const retryAfter = err.headers?.["retry-after"];
    // aguarde `retryAfter` segundos antes de tentar de novo
  }
}
```

`err.headers` traz só os headers da resposta — nenhuma credencial de request entra nele.

### Recusas de plano

`isPlanError(err)` reconhece recusas que só um upgrade resolve (retry não):
`403 plan_restricted` nas escritas de IA, Agenda, Calendário, Jornadas, execuções,
Regras de mensagem do Direct e Perguntas e menu do Instagram
(`422 plan_restricted` em funil, aquecimento e regras de comentário),
`429 free_form_limit_reached` (limite de mensagens 1:1 do Free),
`402 free_number_cap` (setup além do teto de Números do Free ou envio por um
Número suspenso) e `402 free_cap` (2º Cliente no Free ou envio por um Cliente
suspenso). Credencial de IA
nova só para `openai`/`anthropic` (`AI_CREDENTIAL_PROVIDERS`; os demais respondem
`422 provider_not_enabled`); `ai.providers.get()` traz `accepts_new_credentials`
por provedor.

```ts
import { isPlanError } from "@botozap/sdk";

catch (err) {
  if (isPlanError(err)) mostrarUpgrade(err.code);
}
```

### Acima dos limites do Free

O Free permite 1 Cliente (com canal conectado ou não) e 1 número de WhatsApp.
Quem passa disso, por exemplo depois do teste grátis, não é apagado nem
desconectado: fica suspenso. As leituras de `customers` e `phoneNumbers`
(`list`, `get` e o `update` do número) trazem `plan_suspended: true`. O recurso
suspenso continua recebendo mensagens, mas não envia: o envio responde
`402 free_cap` (Cliente suspenso) ou `402 free_number_cap` (Número suspenso; o
Número de um Cliente suspenso também vem com `plan_suspended: true`). Criar o 2º
Cliente no Free responde `402 free_cap`. Assinar libera tudo na hora; para
seguir no Free, desconecte o outro número ou apague o Cliente que não usa.

```ts
import { isFreeCap, isFreeNumberCap } from "@botozap/sdk";

const numeros = await boto.phoneNumbers.list();
const ativos = numeros.data.filter((n) => !n.plan_suspended);

catch (err) {
  if (isFreeNumberCap(err)) avisar("Número suspenso no Free: assine ou desconecte o outro número.");
  else if (isFreeCap(err)) avisar("Negócio suspenso no Free: assine ou apague o outro Cliente.");
}
```

### Plano e slots adicionais

O plano pago inclui 1 negócio. Cada negócio a mais ocupa um slot adicional de
R$ 47/mês, com assinatura própria. Estas rotas aceitam só chave de API, com os
scopes `billing:read` e `billing:write` (OAuth não tem acesso).

```ts
const { plan, can_add_slot, slots } = await boto.billing.get();

// Compra um slot vazio (gera cobrança de R$ 47/mês). A mesma idempotencyKey
// devolve o mesmo slot em vez de comprar outro.
const slot = await boto.billing.slots.create({ idempotencyKey: "compra-2026-10-17" });

// Cancela um slot vazio, sem reembolso.
await boto.billing.slots.cancel(slot.id);
```

Recusas da compra: `402 plan_required` (Free ou teste: assine o plano),
`402 slot_limit` (já há 2 slots com fatura em aberto: pague uma) e
`402 billing_customer_required` (conta sem cadastro de cobrança: fale com o
suporte). Cancelar slot ocupado responde `409 slot_in_use`: desconecte o negócio
antes. `invoice_url` pode vir `null` logo depois da compra; leia de novo em
`billing.get()`.

Cada link de setup traz `connection_billing`, que diz o que acontece quando o
Cliente conectar (`included`, `occupies_slot`, `creates_slot` ou `refused`, com
`message` pronta para mostrar). Cada Cliente traz `business_slot` (`null` quando
está no que o plano inclui).

Quando a fatura de um slot vence há mais de 7 dias, o negócio fica pausado e o
envio responde `402 business_payment_required`. Pagar libera na hora; não é
recusa de plano (`isPlanError` é `false`).

```ts
import { isBusinessPaymentRequired } from "@botozap/sdk";

catch (err) {
  if (isBusinessPaymentRequired(err)) avisarFaturaVencida();
}
```

### Webhooks

`WEBHOOK_CATEGORIES` lista as categorias de `webhooks.create({ events })`:
`messages`, `statuses`, `crm`, `account` (inclui `whatsapp.phone_number.connected`)
e `app_messages`, opt-in, com `whatsapp.message.echo`, `.edited` e `.revoked` do
app WhatsApp Business em coexistência. Em `webhookDeliveries.list`, o status
`limited` marca a entrega cortada pelo limite de repasse do Free (sem retry).

`channel_account_ids` limita um Endpoint a alguns canais (ids de
`channelAccounts.list`, os mesmos de `channel_account.id` nos payloads; 1 a
100). No create, omitido ou `null` = todos os canais. No update, omitido não
muda, `null` volta a todos e um array substitui a lista. A leitura devolve
`channel_account_ids` (`null` = todos; vazio quando os canais marcados foram
excluídos, e o Endpoint então não recebe eventos) e `channels_health`, só com
os canais em falha (`channel_account_id: null` = eventos sem canal). A espera,
as falhas seguidas e a pausa (na 15ª falha) contam por canal: um canal pausado
não para os outros. `health_status` e `failure_streak` do Endpoint resumem o
pior canal; `paused` só aparece quando todos os canais com falha estão
pausados. Erros: `422 invalid_channel_account_ids` e
`404 channel_account_not_found`.

```ts
await boto.webhooks.update(endpointId, { channel_account_ids: [canalId] });
await boto.webhooks.update(endpointId, { channel_account_ids: null }); // todos
const { channels_health } = await boto.webhooks.get(endpointId);
```

## Configuração

```ts
new BotoZap({
  apiKey: "...",
  baseUrl: "https://botozap.com.br/api/v1", // padrão
  fetch: customFetch, // opcional
});
```

> `baseUrl` existe para testes e ambientes controlados. A chave de API é
> enviada como `Authorization: Bearer` para o host configurado — nunca aponte
> `baseUrl`/`BOTOZAP_API_URL` para um host que não seja de sua confiança.

## Recursos

O SDK cobre os recursos da API `/v1`:

- `messages` — enviar texto (com `quick_replies` no Instagram), template e mídia por link, **listar** e buscar por id
- `customers` — listar, buscar, criar, **atualizar**, **remover**, e **links de setup** (listar/criar/atualizar; `channel` `whatsapp` ou `instagram`, um canal por link)
- `templates` — listar, buscar, **criar**
- `broadcasts` — criar, destinatários, agendar, enviar, cancelar
- `contacts` — listar, buscar, criar, atualizar, remover; `display_name` é o nome que a empresa dá ao Contato (1–200 caracteres; `null` limpa), separado do `profile_name` que vem do canal
- `conversations` — listar (filtros `channel` e `channel_account_id`), buscar, atualizar, responder, atribuições; leituras trazem `entry_point` (`ctwa`/`organic`/`null`), `referral` do último clique em anúncio Click-to-WhatsApp, `fep_expires_at` (fim da janela grátis informado pela Meta) e `fep_reply_by` (estimativa do prazo para responder)
- `webhooks` — CRUD e teste; `customer_id` opcional limita as entregas a um Cliente da Conta (`null` no update remove o filtro); `channel_account_ids` limita a alguns canais (`null` = todos) e `channels_health` traz a saúde por canal
- `channelAccounts` — listar e buscar Contas de canal (WhatsApp e Instagram); **Regras de comentário** do Instagram (listar, buscar, criar, atualizar, excluir) e **Perguntas e menu** (ler, salvar/aplicar, remover, verificar/reaplicar)
- `phoneNumbers` — listar, buscar, **atualizar o `label`** (nome local, até 100 caracteres; `null` limpa), remover, saúde
- `media` — subir arquivo (obter um media_id) e **buscar metadados + URL de download** de uma mídia recebida
- `events` — reler inbound e mudanças de status pelo cursor durável da Conta/ambiente
- `usage` — `metaCosts`: custo aproximado da Meta por dia, categoria e moeda (Pricing Analytics), com estimativa por tarifa publicada onde a Meta não devolveu custo
- `billing` — `get`: plano e slots adicionais; `slots.create` (compra, com `idempotencyKey`) e `slots.cancel` (slot vazio, sem reembolso). Só chave de API
- `me` — `get`: Conta, ambiente (`live` ou `sandbox`) e scopes efetivos da chave autenticada; não retorna a chave nem uma identidade pessoal
- `users`, `apiLogs`, `webhookDeliveries` — leitura

`me.get()` é útil para conferir a identidade configurada antes de executar
operações em uma integração:

```ts
const identity = await boto.me.get();
// { account_id: "…", environment: "live", scopes: ["messages:write"] }
```

Inbound e mudanças de status compartilham um stream crescente. Guarde
`paging.cursor` e use-o como `after` na leitura seguinte; após uma desconexão,
isso recupera o intervalo persistido sem depender de memória do processo:

```ts
const page = await boto.events.list({ after: ultimoCursor, limit: 100 });

for (const event of page.data) {
  console.log(event.cursor, event.type, event.data);
}

ultimoCursor = page.paging.cursor;
```

Cada Evento traz `message_id` (o `wamid`, só no WhatsApp; `null` em outros
canais) e `external_id` (o id da mensagem no canal de origem: `wamid` no
WhatsApp, `mid` no Instagram). Para correlacionar mensagens de qualquer canal,
use `external_id`; ambos podem ser `null` em Eventos sem mensagem.

Passe um `AbortSignal` quando a leitura fizer parte de um tail cancelável:

```ts
const controller = new AbortController();
const page = await boto.events.list({
  after: ultimoCursor,
  signal: controller.signal,
});
controller.abort(); // interrompe o I/O se a assinatura deixou de existir
```

```ts
// Transmissão: template_name + template_language são obrigatórios.
await boto.broadcasts.create({
  name: "Promo de sexta",
  phone_number_id,
  template_name: "promo_sexta",
  template_language: "pt_BR",
});

// Destinatários: objetos { to_recipient, components? } (até 1000 por chamada,
// só em draft). Strings soltas NÃO são aceitas. Itens inválidos voltam em
// `errors` ({ index, to_recipient?, reason }) sem derrubar o lote.
const { added, duplicates, errors } = await boto.broadcasts.addRecipients(broadcastId, [
  { to_recipient: "5592999990000" },
  {
    to_recipient: "5592988880000",
    components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }] }],
  },
]);

// Criar um template (submetido à Meta para análise).
await boto.templates.create({
  name: "boas_vindas",
  language: "pt_BR",
  category: "MARKETING",
  components: [{ type: "BODY", text: "Olá {{1}}, seja bem-vindo!" }],
  phone_number_id,
});

// Listar mensagens (paginação por cursor + filtros).
const msgs = await boto.messages.list({ limit: 50, direction: "inbound" });

// Cliente + link de setup (Embedded Signup).
await boto.customers.update(customerId, { name: "Padaria do João" });
const link = await boto.customers.createSetupLink(customerId, {
  allowed_connection_types: ["dedicated"],
  // https, sem usuário/senha, até 2048 caracteres (senão 422 invalid_redirect_url).
  // Concluído → success com ?setup_link_id=…&status=completed. Link esgotado →
  // failure com status=failed; cliente volta num erro recuperável → failure com
  // status=cancelled (o link segue válido). A query da URL é preservada e o
  // token do link nunca é enviado.
  success_redirect_url: "https://seu-app.com/whatsapp/ok?ref=42",
  failure_redirect_url: "https://seu-app.com/whatsapp/erro",
});
// Envie link.url ao Cliente. No sucesso, confirme o número em phoneNumbers.list:
// uma conexão concluída ainda pode ter pendência de registro.

// Cada link conecta um canal só: channel "whatsapp" (padrão) ou "instagram"
// (outro valor → 422 invalid_channel). No Instagram, o Cliente confirma que a
// conta é profissional e que as mensagens estão liberadas e entra com o
// Instagram. allowed_connection_types não vale (enviar → 422
// invalid_connection_types); o link volta com allowed_connection_types: [] e
// url em /instagram/setup/<token>. whatsapp_setup_status vale para os dois
// canais e passa a completed quando a conta do Instagram conecta.
const linkIg = await boto.customers.createSetupLink(customerId, {
  channel: "instagram",
  success_redirect_url: "https://seu-app.com/instagram/ok", // status=completed
  failure_redirect_url: "https://seu-app.com/instagram/erro", // status=cancelled
});
// linkIg.channel === "instagram"

await boto.webhooks.create({
  url: "https://seu-app.com/hooks",
  events: ["messages", "statuses"], // categorias aceitas pela API (a rota rejeita nomes finos)
  customer_id, // opcional: só entregas deste Cliente (omitido = todos da Conta)
});
const { data: numeros } = await boto.phoneNumbers.list({ customer_id });
await boto.phoneNumbers.update(numeros[0]!.id, { label: "Recepção" });

// Custo da Meta (aproximado; a fatura da Meta é a autoridade). Custo ausente
// vem null, nunca 0 — veja `unavailable_reason` e `estimated_cost`.
const custos = await boto.usage.metaCosts({ customer_id, from: "2026-09-01", to: "2026-09-25" });
```

## Exemplos

Exemplos mínimos e rodáveis na raiz do monorepo, em [`examples/`](../../examples):

- [`node-javascript`](../../examples/node-javascript) — envio sandbox e tratamento de `BotoZapError`
- [`node-typescript`](../../examples/node-typescript) — envio tipado, leitura paginada e erro estruturado
- [`webhook-receiver`](../../examples/webhook-receiver) — receber os eventos encaminhados (valida `X-Webhook-Signature`)
- [`mcp-sandbox`](../../examples/mcp-sandbox) — servidor MCP com chave sandbox

## Licença

MIT

## Atendimento, CRM e Agenda

Recursos tipados: `savedReplies`, `inbox`, `opportunities`, `demands`, `radar`,
`journeys`, `appointments` (inclui `services`, `schedules`, `exceptions`),
`calendar`, `contactStages` e `contactFields`. As edições preservam os campos CAS
exigidos pela API. Notas internas nunca enviam mensagem ao contato; rascunhos e
respostas pessoais pertencem à sessão do Painel. Autorize Google Calendar no
Painel antes de gerenciar conexões pelo SDK.

Exemplo: `client.savedReplies.update(id, { body, expected_updated_at: row.updated_at })`.
Não arredonde `updated_at`: preserve a precisão recebida do servidor.
Criação de compromisso aceita segundo argumento `{ idempotencyKey: 'chave-estavel' }`.
[Contratos, exemplos e roteiro de release](https://github.com/bytecraft-fernando/botozap-js/blob/main/docs/attendance-release.md).

IA usa exclusivamente credenciais próprias (BYOK): SDK `client.ai`, CLI `botozap ai`
e ferramentas MCP `ai_*`. Agentes versionados, provedores, credenciais, conhecimento,
memória, skills, follow-ups e retornos prometidos, roteadores, casos, alertas,
avisos, propostas de aprendizado e comerciais, controle de acesso (elegibilidade),
inferências, promessas do operador, catálogo de modelos, execuções e uso. Scopes
`agents:read/write`; aprovação exige chave criada por
owner/admin ainda autorizado. Prévia não envia WhatsApp. Não há carteira, créditos
ou compra de vagas de IA. [Contratos e exemplos IA](https://github.com/bytecraft-fernando/botozap-js/blob/main/docs/ai.md).

### Tarifas próprias de transcrição

`client.ai.usage.saveRate` aceita `audio_pricing` separado das tarifas de texto.
Omitir preserva a configuração anterior; `null` remove a tarifa de áudio.
Informe os preços do contrato da sua chave, sem assumir valores padrão:

- `{ unit: "duration", usd_per_minute }` cobra por duração verificada.
- `{ unit: "tokens", input_audio_usd_per_million, input_text_usd_per_million, output_text_usd_per_million, max_input_tokens, max_output_tokens }` usa as unidades de áudio/texto informadas pelo provedor.

Preços: 0–100.000, até oito casas decimais. Reservas de tokens: inteiros de
1–100.000.000. São estimativas para admissão, não limites técnicos impostos ao
provedor; o custo real pode superar a reserva. Cada chamada preserva sua tarifa.
A ausência de preço ou de medição compatível mantém o custo desconhecido e pode
bloquear novas chamadas. `usage.reprice`, com confirmação explícita, também estima
transcrições anteriores com unidades compatíveis e sem tarifa registrada; não
substitui snapshots nem transforma uma inferência incerta em custo zero.

A CLI `ai usage save-rate` recebe o mesmo JSON por `--input-file`; o MCP expõe
`audio_pricing` opcional e anulável na ferramenta `ai_usage_save_rate`.

## Token OAuth

Além de `apiKey`, o cliente aceita `accessToken`. Um provider permite usar o token renovado em cada requisição:

```ts
const boto = new BotoZap({
  accessToken: async () => getCurrentOAuthAccessToken(),
});
await boto.contacts.list();
```

Informe uma única credencial. O SDK envia `Authorization: Bearer` e não realiza o fluxo de login ou a renovação; o aplicativo fornece o token atual. `boto.me.get()` devolve os scopes e, para OAuth, `auth_type`, `user_id`, `client_id`, `grant_id` e `allowed_routes`. A autorização sempre é revalidada pelo servidor.


### Repetir um envio sem duplicar a intenção

A opção `idempotencyKey` é opcional. Crie uma chave antes da primeira tentativa
e preserve-a se perder a resposta; o corpo e a credencial também devem ser os
mesmos. Sem a opção, o SDK mantém o comportamento anterior.

```ts
const options = { idempotencyKey: crypto.randomUUID() };
await boto.messages.send({ to: "5511999999999", text: "Seu pedido está pronto." }, options);
// Retry da mesma intenção: use novamente o mesmo payload e options.
```

`sendTemplate`, `sendMedia` e `conversations.reply` aceitam a mesma opção como
último argumento. O servidor retorna a resposta original; payload diferente ou
tentativa pendente retornam 409. Resultados terminais ficam disponíveis por 24h.
Pendências desconhecidas não reabrem automaticamente. Depois de 24h, confira o
histórico antes de reenviar; nunca troque a chave para contornar uma pendência.
Requer a API com suporte a `Idempotency-Key` em `POST /v1/messages`.

Recusas confirmadas (`outcome: rejected`) liberam a chave. Aguarde o backoff ou
corrija a causa e repita com a mesma chave; após liberação, outro payload é uma
nova intenção. `unknown` ou `accepted` exigem conciliação antes de considerar
outro envio. SDK e MCP preservam `outcome` e `retry` da API. Resultados concluídos
vencidos são removidos pelo cron a cada minuto; claims incertas não são removidas
por tempo, conforme o runbook `botozap/docs/ops/message-send-receipts.md`.

## Instagram — onda 2

Regras de comentário incluem `dm_button_title`, `delivery_text` e `delivery_media`.
Regras de mensagem têm CRUD com gatilhos e ações tipados (`message-rules:read/write`);
no Free, criar ou editar responde `403 plan_restricted` (pausar com
`{ is_active: false }` e excluir seguem livres);
métricas de comentário recebem `from`/`to` (`comment-rules:read`).
[Contrato e exemplos de SDK, CLI e MCP](../../docs/instagram-wave-two.md).

### Instagram: conexão, QR, lives e seguidores

```ts
const connection = await boto.channelAccounts.getConnection(channelAccountId);
await boto.channelAccounts.resubscribeConnection(channelAccountId);
// Chave de API; no OAuth, a desconexão é feita pelo painel.
await boto.channelAccounts.disconnect(channelAccountId);
const svg = await boto.channelAccounts.getMessageRuleQr(channelAccountId, ruleId, { format: "svg" });
// ArrayBuffer; formato padrão: png. Não contém envelope JSON.
const followers = await boto.contacts.list({ ig_follows_business: true });
const nonFollowers = await boto.conversations.list({ ig_follows_business: false });
```

As Regras de mensagem retornam `ref_link` (`https://ig.me/m/usuario?ref=...` ou `null`). Regras de comentário aceitam `live`; as métricas incluem `posts[].live`. Servidores sem lives habilitadas devolvem `422 feature_unavailable`. Não combine `live: true` com `media_id` ou `next_post`.

Ambos os tipos de regra aceitam `require_follow` e `non_follower_text`. Nas regras de comentário, a condição exige botão e texto para quem não segue (até 640 caracteres); nas de mensagem, esse texto é opcional e limitado a 1.000 bytes. `null` limpa o texto; campos ausentes no PATCH preservam o valor. Contatos expõem somente para leitura `ig_follows_business`, `ig_followed_by_business`, `ig_follower_count`, `ig_verified` e `ig_follow_checked_at`; valores desconhecidos são `null` e ficam fora dos filtros `true` e `false`. Eventos `instagram.message_rule.failed` podem ter `message_id: null` quando vêm de referral sem mensagem.

### IA de comentários do Instagram

```ts
const config = await boto.channelAccounts.getCommentAi(channelAccountId);
await boto.channelAccounts.updateCommentAi(channelAccountId, {
  enabled: true, agent_id: publishedAgentId, daily_limit: 50,
});
const runs = await boto.channelAccounts.listCommentAiRuns(channelAccountId, { page: 1, per_page: 30 });
await boto.channelAccounts.updateCommentAi(channelAccountId, { enabled: false });
```

Leitura e histórico exigem `agents:read`; PATCH exige `agents:write` e capacidade
`ai` do plano, exceto o patch que somente desliga. Sem sandbox; no OAuth, PATCH
é exclusivo do painel. Ativar pode publicar respostas e enviar DMs automáticas.
Campos ausentes preservam a configuração; `agent_id: null` limpa o agente quando
desligada. `daily_limit` aceita inteiros de 1 a 200; o dia usa `America/Sao_Paulo`.
`answered_today` conta respostas públicas confirmadas e `reserved_today` inclui
tentativas incertas. `status`, `gate_mode` e `readiness` descrevem a prontidão.

`InstagramCommentAi` e `InstagramCommentAiRun` tipam os retornos. Execuções deste
recurso incluem `estimated_cost_usd?: number | null` e `finish_reason` com prefixo
`comment_ai_`; `source` continua `live`. `InstagramCommentAiRepliedEvent` tipa
`instagram.comment.replied` com `automation.kind = instagram_comment_ai`,
`execution_id` e `comment_id`. A Private Reply em `instagram.message.sent` traz
`source: agent`, `ai_execution_id` e `comment_id` no conteúdo da mensagem.
