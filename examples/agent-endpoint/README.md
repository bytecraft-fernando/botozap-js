# Exemplo — Endpoint de agente durável

Exemplo executável em Node.js no qual um **Endpoint** recebe Eventos assinados
do BotoZap, persiste cada Evento no PostgreSQL, acorda um worker por
`LISTEN/NOTIFY` e responde ao Contato pela API oficial — sem polling de
Mensagens.

```text
Meta → BotoZap (receiver + inbox/outbox) → Endpoint deste exemplo
                                            │
                                      INSERT + NOTIFY
                                            │
                                      ACK 2xx imediato
                                            │
                                            ▼
                                     worker de agente
                                            │
                                  POST /api/v1/messages → Meta
```

O ACK não espera o agente gerar a resposta. Ele só sai depois do commit do
job; por isso um Evento aceito sobrevive a restart. `X-Idempotency-Key` tem
índice `UNIQUE`, então retry e replay do mesmo Evento não criam outro job nem
outra resposta outbound.

## Pré-requisitos

- Node.js 20.19+ e pnpm;
- PostgreSQL acessível por `DATABASE_URL`;
- chave live do BotoZap com `messages:send`;
- Endpoint criado no BotoZap e seu segredo `whsec_…`.

Instale as dependências na raiz do monorepo:

```bash
pnpm install
```

## Configuração

```bash
export DATABASE_URL='postgresql://app:senha@localhost:5432/app'
export BOTOZAP_API_KEY='bz_live_xxx'
export BOTOZAP_WEBHOOK_SECRET='whsec_xxx'
export BOTOZAP_FALLBACK_TEMPLATE='retomar_atendimento'
export BOTOZAP_FALLBACK_LANGUAGE='pt_BR'
export PORT=3001
```

`BOTOZAP_FALLBACK_TEMPLATE` deve ser um Template aprovado. Quando ele tem
parâmetros, passe o array `components` da Cloud API em JSON por
`BOTOZAP_FALLBACK_COMPONENTS`. Para testar contra outra instalação, use
`BOTOZAP_BASE_URL`.

Sem configuração extra, o worker usa uma resposta determinística segura. Para
conectá-lo ao seu runtime de agente, defina `AGENT_ENDPOINT_URL`; ele receberá
`POST { input, event }` e deve devolver `{ "reply": "..." }` em até 30s.
`AGENT_BEARER_TOKEN` adiciona autenticação sem jamais aparecer nos logs.

## Rodar

Para desenvolvimento, Endpoint e worker podem rodar no mesmo processo:

```bash
pnpm --filter example-agent-endpoint start
```

Em produção, rode-os como processos independentes. O PostgreSQL conecta os dois
sem fila em memória:

```bash
pnpm --filter example-agent-endpoint start:endpoint
pnpm --filter example-agent-endpoint start:worker
```

O schema `agent_jobs` é criado de forma idempotente no startup. Publique
`https://seu-dominio.example/webhooks/botozap`; localhost e rede privada são
recusados pelo guard SSRF do BotoZap. Túnel serve para desenvolvimento, não como
Endpoint permanente.

## Criar e testar o Endpoint

Crie-o em **Webhooks** no painel ou pela API. O `secret` só aparece na resposta
de criação; guarde-o como `BOTOZAP_WEBHOOK_SECRET`:

```bash
curl -sS https://botozap.com.br/api/v1/webhooks \
  -H "Authorization: Bearer $BOTOZAP_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://seu-dominio.example/webhooks/botozap",
    "events": ["messages"],
    "active": true
  }'
```

Valide HMAC, persistência e ACK sem enviar WhatsApp:

```bash
curl -sS -X POST \
  https://botozap.com.br/api/v1/webhooks/$ENDPOINT_ID/test \
  -H "Authorization: Bearer $BOTOZAP_API_KEY"
```

O Evento `webhook.test` é persistido e termina como `ignored` no worker. Só
`whatsapp.message.received` com texto gera resposta.

## Observar Entregas e jobs

Entregas da plataforma, incluindo status HTTP e tentativas:

```bash
curl -sS \
  "https://botozap.com.br/api/v1/webhook_deliveries?webhook_id=$ENDPOINT_ID" \
  -H "Authorization: Bearer $BOTOZAP_API_KEY"
```

Estado local sem exibir o payload/PII:

```sql
select id, event_type, state, attempts, error_code, created_at, updated_at
from agent_jobs
order by id desc
limit 20;
```

Estados `completed` e `ignored` são terminais. Depois de três falhas do runtime
de agente, `failed` funciona como a DLQ local. `ambiguous`/`sending` exigem
inspeção humana e **não são retentados**.
O worker grava `sending` antes de chamar a API e nunca recupera esse estado
automaticamente. Essa escolha preserva a garantia “no máximo uma resposta”:
uma queda nesse ponto pode perder a resposta, mas não manda uma duplicata.

## Replay seguro

Quando uma Entrega chegar a `exhausted`, corrija o Endpoint e use **Operação →
Replay** no painel (owner/admin). O BotoZap reenviará o mesmo corpo com a mesma
`X-Idempotency-Key`. O índice único responde `200 duplicate`, sem novo job e sem
novo outbound. O histórico fica em `webhook_deliveries` e o replay é auditado
pela plataforma.

Se a Entrega foi aceita, mas o runtime do agente esgotou as três tentativas,
reprocesse somente o job local em `failed`:

```bash
pnpm --filter example-agent-endpoint replay -- 123
```

O comando faz uma transição atômica `failed → queued`, zera as tentativas e
acorda o worker por `NOTIFY`. Ele recusa qualquer outro estado, especialmente
`sending` e `ambiguous`.

Não reenvie automaticamente jobs locais em `sending` ou `ambiguous`: a API da
Meta não oferece idempotência de envio e uma resposta anterior pode ter saído.

## Janela de 24h

O worker usa o timestamp inbound com margem de segurança para escolher texto
livre dentro da janela e Template fora dela. A API BotoZap continua sendo a
autoridade: se a janela fechar entre a decisão e o POST, ela devolve
`outside_window` antes de enviar e o adapter faz fallback para o Template
aprovado. Outros erros ambíguos nunca são retentados automaticamente.

## BotoZap Endpoint ≠ receiver da Meta

| | Endpoint deste exemplo | Receiver da Meta no BotoZap |
| --- | --- | --- |
| Quem chama | BotoZap | Meta |
| Header | `X-Webhook-Signature` | `X-Hub-Signature-256` |
| Segredo | `whsec_…` do Endpoint | App Secret da Meta |
| Formato HMAC | hex puro, sem prefixo | `sha256=<hex>` |
| Payload | Evento normalizado do BotoZap | envelope cru da Graph API |

Não configure este exemplo como callback do app Meta. O receiver Meta já é
operado pelo BotoZap e persiste o envelope antes de responder `200`; este
Endpoint é o destino do seu agente no segundo trecho da entrega durável.

## Testes

```bash
pnpm --filter example-agent-endpoint test
```

Os testes HTTP não exigem banco. Para também provar a fila, dedupe,
`LISTEN/NOTIFY` e outbound único contra PostgreSQL real:

```bash
TEST_DATABASE_URL="$DATABASE_URL" \
  pnpm --filter example-agent-endpoint test
```
