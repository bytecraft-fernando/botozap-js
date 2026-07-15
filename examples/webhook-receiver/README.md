# Exemplo — receptor de webhook

Servidor mínimo (só `node:http` e `node:crypto`, zero dependências) que recebe
os eventos que o BotoZap encaminha assinados. Porta fiel do snippet contratado
do core (`src/lib/api-examples/receiver.ts`), que os contract tests validam
contra assinaturas reais.

## Os quatro pontos que importam

1. **Bytes crus** — o HMAC é calculado sobre o corpo exatamente como chegou.
   Reserializar o JSON (parse → stringify) muda espaçamento/ordem de chaves e
   invalida a assinatura.
2. **`X-Webhook-Signature`** — HMAC-SHA256 hex do corpo cru com o segredo
   `whsec_…` (tela Webhooks), comparação **constant-time**
   (`timingSafeEqual`). Sem prefixo `sha256=`.
3. **`X-Idempotency-Key`** — a entrega é *at-least-once*: duplicatas raras
   acontecem. Grave a chave **e** o efeito na **mesma transação**
   (`INSERT … ON CONFLICT DO NOTHING` + escritas do evento antes do COMMIT).
   Nunca check-then-act — checar "já vi essa chave?" e processar depois perde
   eventos em crash no meio.
4. **Só responda 2xx depois do commit** — 2xx é o único ACK que o BotoZap
   aceita; qualquer outra resposta (ou timeout) gera nova tentativa. Um
   payload permanentemente inválido deve responder 200-e-ignorar para não
   ficar em retry eterno.

## Rodar

```bash
BOTOZAP_WEBHOOK_SECRET=whsec_xxx PORT=3001 node index.mjs
```

`processEventOnce` lança de propósito — implemente a transação única
(chave + efeito) no seu banco antes de usar em produção.
