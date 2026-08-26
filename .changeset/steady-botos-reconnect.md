---
"@botozap/mcp": patch
"@botozap/sdk": patch
---

Torna o push remoto resiliente a queda ou indisponibilidade inicial do event
bus, sinais concorrentes, restart e clientes abandonados. Adiciona heartbeat de
reconciliação por cursor, limites de sessão/assinatura, cleanup por cancelamento
ou expiração e testes de carga e isolamento entre Conta e ambiente. Leituras de
Eventos do SDK agora aceitam `AbortSignal`, permitindo cancelar I/O em voo.
