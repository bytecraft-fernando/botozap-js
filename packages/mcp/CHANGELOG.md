# @botozap/mcp

## 0.2.3

### Patch Changes

- 05e1c9f: Adiciona `headers.Authorization` aos Endpoints de webhook. O valor é aceito
  somente na escrita, nunca aparece nos resultados do SDK/MCP e é persistido no
  Vault pelo core BotoZap.
- e5ba3e0: Recupera a capacidade de sessão ao substituir a conexão abandonada mais antiga
  da mesma credencial quando o teto é atingido, sem preemptar requests ativos.
- Updated dependencies [05e1c9f]
  - @botozap/sdk@0.3.2

## 0.2.2

### Patch Changes

- 94912b5: Endurece o transporte Streamable HTTP para exposição pública com allowlists de
  Host e Origin, readiness em `/healthz`, rate limits antes da autenticação,
  timeouts defensivos, allowlist de proxy/CIDR e recusa de bind público inseguro.

## 0.2.1

### Patch Changes

- Publica novamente o candidato agent-native validado em versões patch para
  promovê-lo diretamente ao canal `latest` do npm.
- Updated dependencies
  - @botozap/sdk@0.3.1

## 0.2.0

### Minor Changes

- 05733ec: Adiciona o stream durável `events.list` ao SDK e um resource MCP assinável por
  cursor. O servidor stdio anuncia subscriptions, envia
  `notifications/resources/updated` enquanto a assinatura está ativa e preserva
  as tools e o fallback de replay após reconexão.
- de26959: Adiciona output schemas e structured content às tools centrais de Mensagens,
  Números e Templates, preservando o fallback textual e expondo erros estruturados.
  Sincroniza também o tipo `SendResult` do SDK com o campo aditivo `sent_to` da API.
- 2b68e8a: Adiciona transporte remoto Streamable HTTP stateful, autenticação Bearer presa à
  sessão e notifications de Eventos entre processos por event bus PostgreSQL,
  preservando o transporte stdio e todas as tools existentes.
- d3b1e57: Completa output schemas e structured content nas 35 tools publicadas, incluindo
  paginação, gestão e operações sem corpo, com fallback textual compatível.
- da01362: Adiciona `conversations.reply` ao SDK e a tool MCP
  `reply_to_conversation`, que resolvem Contato e Número pela Conversa e
  delegam ao endpoint canônico de mensagens, preservando janela, quota, billing
  e isolamento multi-tenant no servidor.
- 42c65ef: Adiciona envio tipado de image, video, audio e document pelo SDK e pela tool MCP `send_media_message`, com limites e campos específicos por tipo.

### Patch Changes

- e923a96: Torna o push remoto resiliente a queda ou indisponibilidade inicial do event
  bus, sinais concorrentes, restart e clientes abandonados. Adiciona heartbeat de
  reconciliação por cursor, limites de sessão/assinatura, cleanup por cancelamento
  ou expiração e testes de carga e isolamento entre Conta e ambiente. Leituras de
  Eventos do SDK agora aceitam `AbortSignal`, permitindo cancelar I/O em voo.
- Updated dependencies [05733ec]
- Updated dependencies [de26959]
- Updated dependencies [e923a96]
- Updated dependencies [da01362]
- Updated dependencies [42c65ef]
  - @botozap/sdk@0.3.0
