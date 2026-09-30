# Rodada 4A.2 — prévia primeiro, técnico escondido

A prévia fiel ocupa a primeira posição em todos os templates suportados, com os valores sugeridos pelo contexto. “Editar campos” começa fechado e agrupa os controles por mensagem/card; “Avançado” recolhe referências de mídia, destinos de botão, payloads, coordenadas, catálogo e formato de parâmetros. Código de autenticação fica visível, com o aviso de emissão pelo sistema do negócio. Nada foi alterado nos registros compartilhados, telas de outros workers, contratos ou recursos MCP.

A UI envia contexto legível pelo protocolo MCP Apps: prévia, nome do template, variáveis com nomes humanos, chaves de staging e estado da revisão. URLs de mídia ficam protegidas/omitidas do mapa sugerido. A tool existente `stage_review_template` aplica ajustes no mesmo card, preserva dados não alterados e invalida a intenção anterior; confirmação/envio/incerto impedem alterações. Abrir a prévia não abre automaticamente uma elicitação adicional. Campos obrigatórios faltantes geram aviso humano com atalho que abre e foca o controle.

O simulador interpreta pedidos apenas no host (`web/scenarios/template.ts`) e entrega resultado de staging por `ui/notifications/tool-result`. Roteiro: escolher “4 · Carrossel”, abrir “Usar template aprovado”, digitar **“Muda o nome para Mariana e troca a imagem do segundo card pela coleção Floresta”**, conferir a prévia atualizada, revisar e enviar. A UI real não interpreta texto, inventa imagem nem baixa mídia externa.

## Executar

`pnpm --filter @botozap/mcp demo:ui` → http://127.0.0.1:4173/chat

Capturas/axe: `node packages/mcp/tests/templates-4a2-capture.mjs` com o servidor de demo ativo. Dados fictícios do Ateliê das Águas, claro/escuro, desktop/mobile. O vídeo (aproximadamente 10 segundos) mostra o carrossel sendo ajustado pela conversa e enviado após confirmação.

## Validação

- `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm gate:tarballs` e guarda HTTP do CI.
- 543 testes: SDK 173, CLI 105, MCP 265 (16 novos nesta rodada).
- 100 capturas de template com zero violações axe WCAG A/AA, sem overflow horizontal da página/iframe e sem requests externos.
- Testes de hierarquia/recolhimento para todos os 10 tipos completos, resumo legível sem URL sensível, staging sem envio, bloqueio após confirmação, atalho para mídia faltante e código visível.
- Sem flags de produção, deploy ou publicação. WhatsApp Flows continua bloqueado.

## Limites e decisões

Não há nova decisão de produto pendente. A alteração usa os contratos existentes; no ChatGPT real, o modelo deve chamar staging com os valores revisados e preservar os demais campos, conforme o contexto fornecido. O simulador reconhece um conjunto explícito de exemplos e utiliza imagens por identificador fictício; não resolve acervos reais nem transforma pedidos livres em buscas de mídia.

Os textos estáticos e rótulos de botão pertencem ao template aprovado e permanecem imutáveis; edita-se apenas o conteúdo variável aceito pela API. A prévia continua usando placeholders locais de mídia. As lacunas do app já registradas permanecem: criação de oferta limitada, preservação de `parameter_format: NAMED`/exemplos nomeados e renderização do snapshot de oferta.

A branch do worker B deve receber o SHA desta rodada depois do seu rebase sobre `8c6c8ae`; todas as mudanças ficaram nos arquivos de template, testes/capturas e docs.

## Capturas
- `screenshots/4a2-template-previa-desktop-light.png`
- `screenshots/4a2-template-campos-desktop-light.png`
- `screenshots/4a2-template-image-previa-desktop-light.png`
- `screenshots/4a2-template-image-campos-desktop-light.png`
- `screenshots/4a2-template-image-avancado-desktop-light.png`
- `screenshots/4a2-template-document-previa-desktop-light.png`
- `screenshots/4a2-template-document-campos-desktop-light.png`
- `screenshots/4a2-template-document-avancado-desktop-light.png`
- `screenshots/4a2-template-video-previa-desktop-light.png`
- `screenshots/4a2-template-video-campos-desktop-light.png`
- `screenshots/4a2-template-location-previa-desktop-light.png`
- `screenshots/4a2-template-location-campos-desktop-light.png`
- `screenshots/4a2-template-auth-previa-desktop-light.png`
- `screenshots/4a2-template-one-tap-previa-desktop-light.png`
- `screenshots/4a2-template-carousel-previa-desktop-light.png`
- `screenshots/4a2-template-carousel-conversa-desktop-light.png`
- `screenshots/4a2-template-carousel-campos-desktop-light.png`
- `screenshots/4a2-template-carousel-avancado-desktop-light.png`
- `screenshots/4a2-template-offer-previa-desktop-light.png`
- `screenshots/4a2-template-offer-campos-desktop-light.png`
- `screenshots/4a2-template-catalog-previa-desktop-light.png`
- `screenshots/4a2-template-catalog-campos-desktop-light.png`
- `screenshots/4a2-template-named-previa-desktop-light.png`
- `screenshots/4a2-template-named-campos-desktop-light.png`
- `screenshots/4a2-template-named-avancado-desktop-light.png`
- `screenshots/4a2-template-previa-mobile-light.png`
- `screenshots/4a2-template-campos-mobile-light.png`
- `screenshots/4a2-template-image-previa-mobile-light.png`
- `screenshots/4a2-template-image-campos-mobile-light.png`
- `screenshots/4a2-template-image-avancado-mobile-light.png`
- `screenshots/4a2-template-document-previa-mobile-light.png`
- `screenshots/4a2-template-document-campos-mobile-light.png`
- `screenshots/4a2-template-document-avancado-mobile-light.png`
- `screenshots/4a2-template-video-previa-mobile-light.png`
- `screenshots/4a2-template-video-campos-mobile-light.png`
- `screenshots/4a2-template-location-previa-mobile-light.png`
- `screenshots/4a2-template-location-campos-mobile-light.png`
- `screenshots/4a2-template-auth-previa-mobile-light.png`
- `screenshots/4a2-template-one-tap-previa-mobile-light.png`
- `screenshots/4a2-template-carousel-previa-mobile-light.png`
- `screenshots/4a2-template-carousel-conversa-mobile-light.png`
- `screenshots/4a2-template-carousel-campos-mobile-light.png`
- `screenshots/4a2-template-carousel-avancado-mobile-light.png`
- `screenshots/4a2-template-offer-previa-mobile-light.png`
- `screenshots/4a2-template-offer-campos-mobile-light.png`
- `screenshots/4a2-template-catalog-previa-mobile-light.png`
- `screenshots/4a2-template-catalog-campos-mobile-light.png`
- `screenshots/4a2-template-named-previa-mobile-light.png`
- `screenshots/4a2-template-named-campos-mobile-light.png`
- `screenshots/4a2-template-named-avancado-mobile-light.png`
- `screenshots/4a2-template-previa-desktop-dark.png`
- `screenshots/4a2-template-campos-desktop-dark.png`
- `screenshots/4a2-template-image-previa-desktop-dark.png`
- `screenshots/4a2-template-image-campos-desktop-dark.png`
- `screenshots/4a2-template-image-avancado-desktop-dark.png`
- `screenshots/4a2-template-document-previa-desktop-dark.png`
- `screenshots/4a2-template-document-campos-desktop-dark.png`
- `screenshots/4a2-template-document-avancado-desktop-dark.png`
- `screenshots/4a2-template-video-previa-desktop-dark.png`
- `screenshots/4a2-template-video-campos-desktop-dark.png`
- `screenshots/4a2-template-location-previa-desktop-dark.png`
- `screenshots/4a2-template-location-campos-desktop-dark.png`
- `screenshots/4a2-template-auth-previa-desktop-dark.png`
- `screenshots/4a2-template-one-tap-previa-desktop-dark.png`
- `screenshots/4a2-template-carousel-previa-desktop-dark.png`
- `screenshots/4a2-template-carousel-conversa-desktop-dark.png`
- `screenshots/4a2-template-carousel-campos-desktop-dark.png`
- `screenshots/4a2-template-carousel-avancado-desktop-dark.png`
- `screenshots/4a2-template-offer-previa-desktop-dark.png`
- `screenshots/4a2-template-offer-campos-desktop-dark.png`
- `screenshots/4a2-template-catalog-previa-desktop-dark.png`
- `screenshots/4a2-template-catalog-campos-desktop-dark.png`
- `screenshots/4a2-template-named-previa-desktop-dark.png`
- `screenshots/4a2-template-named-campos-desktop-dark.png`
- `screenshots/4a2-template-named-avancado-desktop-dark.png`
- `screenshots/4a2-template-previa-mobile-dark.png`
- `screenshots/4a2-template-campos-mobile-dark.png`
- `screenshots/4a2-template-image-previa-mobile-dark.png`
- `screenshots/4a2-template-image-campos-mobile-dark.png`
- `screenshots/4a2-template-image-avancado-mobile-dark.png`
- `screenshots/4a2-template-document-previa-mobile-dark.png`
- `screenshots/4a2-template-document-campos-mobile-dark.png`
- `screenshots/4a2-template-document-avancado-mobile-dark.png`
- `screenshots/4a2-template-video-previa-mobile-dark.png`
- `screenshots/4a2-template-video-campos-mobile-dark.png`
- `screenshots/4a2-template-location-previa-mobile-dark.png`
- `screenshots/4a2-template-location-campos-mobile-dark.png`
- `screenshots/4a2-template-auth-previa-mobile-dark.png`
- `screenshots/4a2-template-one-tap-previa-mobile-dark.png`
- `screenshots/4a2-template-carousel-previa-mobile-dark.png`
- `screenshots/4a2-template-carousel-conversa-mobile-dark.png`
- `screenshots/4a2-template-carousel-campos-mobile-dark.png`
- `screenshots/4a2-template-carousel-avancado-mobile-dark.png`
- `screenshots/4a2-template-offer-previa-mobile-dark.png`
- `screenshots/4a2-template-offer-campos-mobile-dark.png`
- `screenshots/4a2-template-catalog-previa-mobile-dark.png`
- `screenshots/4a2-template-catalog-campos-mobile-dark.png`
- `screenshots/4a2-template-named-previa-mobile-dark.png`
- `screenshots/4a2-template-named-campos-mobile-dark.png`
- `screenshots/4a2-template-named-avancado-mobile-dark.png`

## Vídeo

- `screenshots/roteiro-4a2-template-carousel-conversa-desktop-dark.webm`
