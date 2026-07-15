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
`GET /messages` e `GET /messages/:id` — as demais rotas respondem
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

// De um número específico (obrigatório se a conta tem mais de um)
await boto.messages.send({
  to: "+5531988887777",
  text: "Olá!",
  from: "phone_number_id_aqui",
});
```

## Clientes e templates

```ts
const { data: customers, meta } = await boto.customers.list({ per_page: 20 });
const customer = await boto.customers.get("uuid-do-cliente");

const { data: templates } = await boto.templates.list();
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

// Offset/página (customers, templates, broadcasts, phoneNumbers, users, flows,
// conversations.listAssignments): params { page, per_page }.
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

- `messages` — enviar texto e template, **listar** e buscar por id
- `customers` — listar, buscar, criar, **atualizar**, **remover**, e **links de setup** (listar/criar/atualizar)
- `templates` — listar, buscar, **criar**
- `broadcasts` — criar, destinatários, agendar, enviar, cancelar
- `contacts` — listar, buscar, criar, atualizar, remover
- `conversations` — listar, buscar, atualizar, atribuições
- `webhooks` — CRUD e teste
- `phoneNumbers` — listar, buscar, remover, saúde (a rota de update não expõe campos editáveis, então o SDK não tem `phoneNumbers.update`)
- `flows` — criar, versionar, publicar, data endpoint (as operações por flow exigem `phone_number_id`, que amarra o flow à sua WABA)
- `media` — subir arquivo e obter um media_id
- `users`, `apiLogs`, `webhookDeliveries` — leitura

```ts
// Transmissão: template_name + template_language são obrigatórios.
await boto.broadcasts.create({
  name: "Promo de sexta",
  phone_number_id,
  template_name: "promo_sexta",
  template_language: "pt_BR",
});

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
});

await boto.webhooks.create({
  url: "https://seu-app.com/hooks",
  events: ["messages", "statuses"], // categorias aceitas pela API (a rota rejeita nomes finos)
});
const { data: numeros } = await boto.phoneNumbers.list({ customer_id });
```

## Exemplos

Exemplos mínimos e rodáveis na raiz do monorepo, em [`examples/`](../../examples):

- [`node-javascript`](../../examples/node-javascript) — envio sandbox e tratamento de `BotoZapError`
- [`node-typescript`](../../examples/node-typescript) — envio tipado, leitura paginada e erro estruturado
- [`webhook-receiver`](../../examples/webhook-receiver) — receber os eventos encaminhados (valida `X-Webhook-Signature`)
- [`mcp-sandbox`](../../examples/mcp-sandbox) — servidor MCP com chave sandbox

## Licença

MIT
