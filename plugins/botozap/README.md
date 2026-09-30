# BotoZap — pacote candidato 0.2.0

Pacote portátil atualizado para as oito telas: pendências/carrossel, resposta pronta, Radar/conversa, template aprovado, plantão ao vivo, casos da IA, agendamento e entrada global. A identidade, endpoint OAuth e ícone existentes foram preservados. Base em inglês, tradução pt-BR e targeting BR mantidos.

As skills só chamam tools descobertas na conexão. UI depende dos PRs #14/#17 no servidor, capacidades do host, permissões e habilitação da Conta. O ZIP não habilita UI nem registra entrypoints: thread/global/display modes são metadados das tools/recursos MCP. Sem UI, consultar/preparar e concluir no painel web. Nunca enviar sem confirmação do usuário na UI; administração, credenciais de IA e webhooks ficam no painel web.

## Validar e empacotar

Na raiz do repositório, Python 3.9+ (sem instalar dependências):

```sh
python3 plugins/botozap/scripts/package.py
python3 plugins/botozap/scripts/package.py --zip /tmp/botozap-plugin-0.2.0.zip
python3 plugins/botozap/scripts/test_package.py
unzip -l /tmp/botozap-plugin-0.2.0.zip
shasum -a 256 /tmp/botozap-plugin-0.2.0.zip
```

Para conferir as declarações diretamente contra as revisões dos PRs disponíveis no clone:

```sh
python3 plugins/botozap/scripts/package.py --catalog-ref origin/feat/mcp-ui-chatgpt --catalog-ref origin/mcp-ui-live
```

`ui-contracts.json` registra os nomes e argumentos obrigatórios verificados nas revisões de origem. A validação padrão distingue os contratos planejados das tools ainda ausentes no main local. `--catalog-ref` faz uma conferência adicional no código Git, sem checkout/edição do servidor; não verifica catálogo remoto ou disponibilidade no ChatGPT.

O ZIP reproduzível contém somente os dois manifests, ícone e seis SKILL.md: 9 arquivos, ordem/timestamp/permissões fixos. `.env`, segredos, credenciais/instruções privadas, scripts, docs, contratos, vídeos e screenshots não entram. Links simbólicos nos caminhos selecionados e padrões conhecidos de tokens são rejeitados; isso não substitui revisão humana de dados privados.

## Estado de submissão

Os cinco positivos e três negativos estão em inglês no manifest e traduzidos em [pilot-materials.md](pilot-materials.md), ainda **não executados**. `--submission-ready` continua falhando de propósito: pacote estrutural válido não é pronto para submissão.

Faltam execução na Conta dedicada com as versões UI integradas, gravação real pública, verificação de publisher/scans/atestações e acesso seguro do revisor. Os quatro links públicos existem; a cobertura específica de dados compartilhados com ChatGPT ainda precisa de revisão pelo responsável. Suporte foi conferido por conteúdo em 30/09/2026, não só por HTTP 200.

Veja a auditoria da documentação oficial, dependências, hash e inventário no [RELATORIO.md](RELATORIO.md). Este trabalho não faz npm, deploy, troca de flags ou operações no portal.
