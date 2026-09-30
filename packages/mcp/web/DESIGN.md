# Painel de revisão MCP

Referências: `botozap/docs/DESIGN.md`, `src/app/globals.css`, Inbox (`inbox-layout.tsx`) e Radar (`radar/page.tsx`), mais a referência de formulários e foco da skill Refero Design. Direção travada: Encontro das Águas, neutros Rio Negro, ação rosa, verde apenas para estado positivo, painéis de 16px e campos de 12px. Sem imagens ou dependências externas no iframe.

| Decisão | Fonte | Aplicação |
|---|---|---|
| Radar ao lado do histórico | Inbox / Radar existentes | Seleção visível durante leitura e revisão |
| Metadados de canal e destinatário na revisão | Brief de segurança | Confirmação separada do rascunho |
| Foco visível, labels, anúncios assíncronos | Refero craft-details | Teclado e leitor de tela |
| Layout empilhado até 650px | Brief responsivo | Radar compacto e histórico legível |

O demo tem dados fictícios e ponte simulada. O entrypoint de produção usa exclusivamente `App.callServerTool`. A API oficial foi consultada no fonte `modelcontextprotocol/ext-apps/src/app.ts` para constructor, `connect`, `callServerTool`, `updateModelContext`, `ontoolresult` e tema.

O envio de texto é restrito a conversas WhatsApp com janela aberta. Outros canais e templates exigem o painel BotoZap. Um envio aceito limpa o rascunho. Cada intenção manual recebe um UUID de idempotência; rascunhos preparados preservam `draft.idempotency_key`. Mudanças no texto ou na conversa recebem outra chave. Uma recusa confirmada (`structuredContent.error.outcome=rejected`) libera o texto para correção; revisar o mesmo payload mantém a chave e editar cria outra. Falhas na consulta anterior ao primeiro POST também liberam a preparação, pois não houve envio. As recusas zeram o relógio da tentativa, pois o servidor libera a chave. Indicações de `retry=backoff` orientam a aguardar; a UI não repete automaticamente. Sem confirmação explícita de recusa, o resultado permanece incerto. Um resultado ambíguo congela o texto e oferece apenas uma repetição explícita com o mesmo payload e chave. Não há repetição automática. O primeiro POST marca o início da validade de 24 horas da tentativa; repetições preservam esse horário. Depois de 24 horas, a UI bloqueia a repetição e orienta a conferir o histórico no painel, sem gerar outra chave. A chave é enviada em `reply_to_conversation.idempotency_key`, com proteção de idempotência no servidor. As intenções manuais ficam na memória do iframe; recarregar a UI não restaura um rascunho pendente. A releitura anterior ao envio reduz mudanças de contexto, mas não elimina alterações concorrentes entre GET e POST.
