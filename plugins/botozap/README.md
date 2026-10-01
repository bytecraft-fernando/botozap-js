# BotoZap — pacote candidato 0.3.0

Pacote portátil atualizado para as oito telas: pendências/carrossel, resposta pronta, Radar/conversa, template aprovado, plantão ao vivo, casos da IA, agendamento e entrada global. A identidade, endpoint OAuth e ícone existentes foram preservados. Base em inglês, tradução pt-BR e targeting BR mantidos.

As skills só chamam tools descobertas na conexão. Os PRs #14/#15/#17 estão integrados em main; UI depende da versão implantada do servidor, capacidades do host, permissões e habilitação da Conta. O ZIP não habilita UI nem registra entrypoints: thread/global/display modes são metadados das tools/recursos MCP. Pedidos completos e explícitos usam tools diretas com permissão do ChatGPT. Pedidos vagos, escolhas e preparação/revisão usam UI e confirmação nela. Criar definição de template usa create_template diretamente; a UI de template só envia aprovado. Sem UI, revisão no painel; pedidos completos mantêm a rota direta; administração, credenciais de IA e webhooks ficam no painel web.

## Validar e empacotar

Na raiz do repositório, Python 3.9+ (sem instalar dependências):

```sh
python3 plugins/botozap/scripts/package.py
python3 plugins/botozap/scripts/package.py --zip /tmp/botozap-plugin-0.3.0.zip
python3 plugins/botozap/scripts/test_package.py
unzip -l /tmp/botozap-plugin-0.3.0.zip
shasum -a 256 /tmp/botozap-plugin-0.3.0.zip
```

A validação lê o catálogo real no código integrado de main, incluindo a fixture 0.6.0 e as declarações de tools. Falha se qualquer tool de UI estiver ausente; não acrescenta contratos planejados ao catálogo. `ui-contracts.json` registra a base integrada `f586343`. Isso valida código local, não disponibilidade remota no ChatGPT.

O ZIP reproduzível contém somente os dois manifests, ícone e seis SKILL.md: 9 arquivos, ordem/timestamp/permissões fixos. `.env`, segredos, credenciais/instruções privadas, scripts, docs, contratos, vídeos e screenshots não entram. Links simbólicos nos caminhos selecionados e padrões conhecidos de tokens são rejeitados; isso não substitui revisão humana de dados privados.

## Estado de submissão

Os cinco positivos e três negativos estão em inglês no manifest e traduzidos em [pilot-materials.md](pilot-materials.md), ainda **não executados**. `--submission-ready` continua falhando de propósito: pacote estrutural válido não é pronto para submissão.

Faltam execução na Conta dedicada com as versões UI integradas, gravação real pública, verificação de publisher/scans/atestações e acesso seguro do revisor. Os quatro links públicos existem; a cobertura específica de dados compartilhados com ChatGPT ainda precisa de revisão pelo responsável. Suporte foi conferido por conteúdo em 30/09/2026, não só por HTTP 200.

Veja a auditoria da documentação oficial, dependências, hash e inventário no [RELATORIO.md](RELATORIO.md). Este trabalho não faz npm, deploy, troca de flags ou operações no portal.

A conta real Meta Reviewer tem um negócio, um número, 12 contatos, seis templates APPROVED e nenhum serviço de agenda. Os testes revisados não incluem agendamento; P01/P05 admitem janela fechada e P02 usa confirmacao_pedido. Dados de acesso ficam fora do ZIP e só entram nos campos seguros do portal.

## Textos da vitrine 0.3.0

Os textos de categoria, descrições e release notes foram aprovados pelo dono. O subtitle pt-BR aprovado tem 34 caracteres, acima do limite local de 30; foi preservado literalmente e o empacotador emite aviso. O responsável precisa confirmar a aceitação do campo traduzido no portal ou aprovar uma versão curta antes da submissão. Nenhuma tradução de release notes foi adicionada: o contrato existente só define subtitle e description em translations.

`review.demo_recording_url` permanece ausente. Placeholder operacional: **[PENDENTE: URL HTTPS da gravação real fornecida pelo dono]**. Não inserir esse texto como URL no manifest; quando o dono fornecer a URL real, preencher o campo e regenerar o pacote. A ausência gera aviso e mantém a submissão bloqueada, mas permite o ZIP candidato local.
