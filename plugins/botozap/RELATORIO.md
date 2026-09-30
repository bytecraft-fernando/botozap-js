# Pacote do plugin — oito telas (30/09/2026)

Branch própria `feat/plugin-pack-ui`, baseada em `origin/main` e832a58. Alterações restritas a `plugins/botozap/**`; sem edição de packages/mcp, npm, deploy, flags ou portal. Versão portátil 0.2.0, identidade/endpoint/ícone preservados.

## Resultado

Seis skills cobrem as oito telas: pendências/carrossel (list_radar), resposta (stage_review_reply), Radar/conversa (open_review_panel), template (stage_review_template), plantão (open_live_conversation), casos (open_agent_cases), agenda (stage_appointment_booking) e global (open_botozap). review_template_variables é auxiliar opcional, nunca aberto automaticamente. Todas exigem confirmação na UI para envio/mutação; sem UI, somente leitura/preparação e conclusão no painel web. Administração/credenciais/webhooks não são operados pelo plugin.

Cinco positivos e três negativos importáveis em inglês, com tradução pt-BR e preparação reproduzível em pilot-materials.md. Cobrem revisão/envio confirmado, template completo aprovado com prévia primeiro, casos, agenda, plantão/entrada global; negativos cobrem administração, pular confirmação e outra Conta. Estão **não executados**, sem credenciais ou IDs reais.

## Auditoria oficial e divergências

Conferido na documentação atual de [submissão](https://developers.openai.com/plugins/deploy/submission) e [Extensions](https://developers.openai.com/plugins/build/extensions):

- Manifest portátil: listagem em extensions.com.openai.interface; onboardingSkill, review e publication no mesmo namespace. Um servidor: exatamente 5 positivos/3 negativos em review.test_cases, campos textuais; traduções de casos ficam nos materiais, não em campos inventados do manifest.
- Limites validados: displayName/subtitle 30, descrição 4000, developerName 80; até 3 prompts únicos, de uma linha, 128 caracteres; quatro URLs HTTPS, ícone PNG quadrado 1024×1024, abaixo de 5 MiB. Nenhuma vinculação privada apps/.app.json.
- Thread/global são entrypoints da metadata das tools MCP, não do ZIP. Display modes, PiP, contexto e formulários dependem do host/servidor. Nenhum campo fictício de entrypoint foi acrescentado ao manifest.
- A divergência inicial era o pacote só conhecer duas tools de UI. Corrigida nas skills/casos/validação; main ainda não contém seis novas tools UI. Contratos verificados em PR #14 SHA 498277f e PR #17 SHA ebfe41e, registrados em ui-contracts.json, fora do ZIP. --catalog-ref valida declarações em revisões Git, sem afirmar disponibilidade remota; worker B continua responsável pelo servidor.
- “Criar template completo” significa preparar uma mensagem com template aprovado. Criação/aprovação de definição não existe nesta UI e permanece administrativa no painel web. Não foi inventada essa capacidade.
- Gravação obrigatória e execução real dos casos faltam; as demos fictícias não as substituem. --submission-ready continua bloqueado. Publisher/scans/atestações/acesso seguro do revisor são pendências externas.

Os links [website](https://botozap.com.br), [suporte](https://botozap.com.br/suporte), [privacidade](https://botozap.com.br/privacidade) e [termos](https://botozap.com.br/termos) foram inspecionados publicamente. Suporte retornou HTTP 200 e conteúdo próprio com canais de ajuda e orientação para envios incertos (curl; o navegador de pesquisa não o abriu). As políticas acessíveis tratam o produto, mas não mencionam ChatGPT; a cobertura específica desta integração requer revisão do responsável, sem presumir insuficiência jurídica nem editar políticas.

## Validação e artefato

Comandos executados:

```sh
python3 plugins/botozap/scripts/package.py
python3 plugins/botozap/scripts/test_package.py
python3 plugins/botozap/scripts/package.py --catalog-ref 498277f87e6384cc429b7679e6c2033f7d10f0b9 --catalog-ref ebfe41e65976c2dd88d30d2cee6e9f030d2858b6 --zip /tmp/botozap-plugin-0.2.0.zip
python3 plugins/botozap/scripts/package.py --zip /tmp/botozap-plugin-0.2.0-rebuild.zip
cmp /tmp/botozap-plugin-0.2.0.zip /tmp/botozap-plugin-0.2.0-rebuild.zip
```

Seis testes offline passaram: igualdade binária, allowlist (exclui .env/screenshots/instruções privadas), metadata privada, token em skill, tool desconhecida, symlink/binding privado, limites de listagem e bloqueio de readiness. ZIP inspecionado sem scripts/docs/contratos, screenshots grandes, segredos ou campos privados; os padrões de tokens são uma defesa adicional, não prova geral de ausência de segredos.

ZIP: `/tmp/botozap-plugin-0.2.0.zip` · 760671 bytes

SHA-256: `4819df8ce49a84d5ee7e4cae7bfc6ed68756f1dcc78575ed132e9fc4e738fda7`

Inventário exato:

- `assets/icon.png`
- `mcp.json`
- `plugin.json`
- `skills/casos-da-ia/SKILL.md`
- `skills/conectar-botozap/SKILL.md`
- `skills/marcar-horario/SKILL.md`
- `skills/plantao-ao-vivo/SKILL.md`
- `skills/preparar-template/SKILL.md`
- `skills/revisar-pendencias/SKILL.md`
