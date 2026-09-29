# Material operacional do piloto — fora do ZIP

Status: casos planejados e não executados. O manifesto é a fonte importável de
P01–P05/N01–N03; este arquivo descreve a preparação e os gates do ensaio. Não
contém nem deve receber credenciais ou instruções privadas de acesso.

## Fixture controlada BotoZap Review BR

Preparar uma Conta dedicada, com dados de teste, dois negócios `Review Alpha`
e `Review Beta`, uma oportunidade com conversa vinculada e `Review Contact` com
janela WhatsApp aberta. O canal e o destinatário devem pertencer ao operador do
ensaio e permitir o teste de envio. Descobrir os IDs e o destinatário pela API;
nenhum identificador ou telefone real é embutido no material.

Preparar também `Review Closed` com janela encerrada, `Review Instagram` como
canal não suportado pelo envio do painel e uma fixture `Review Foreign` em outra
Conta. Usar um grant OAuth próprio para o teste de revogação. Executar os casos
sem alterar contas, grants ou contatos de clientes reais.

A matriz interna RT01 precisa simular perda da resposta HTTP **depois do aceite** e
concorrência da mesma chave. A simulação ainda não foi executada no ambiente de
revisão. Preservar a chave e o corpo da primeira tentativa; verificar que o replay
não causa novo efeito externo. Timeout sozinho não prova que o envio falhou.

RT01 é um ensaio interno com harness controlado, fora dos casos importáveis
do portal. P05 é uma consulta do histórico que o revisor pode executar depois
de P04 usando a Conta de revisão.

## Registro de execução e gravação

| Caso | Evidência a coletar | Estado |
| --- | --- | --- |
| P01 | Conta correta e escolha explícita entre os negócios | Pendente |
| P02 | Radar, conversa vinculada, histórico e paginação | Pendente |
| P03 | Rascunho editável, negócio derivado e nenhum envio | Pendente |
| P04 | Revisão explícita, uma aceitação e ID/status retornados | Pendente |
| P05 | Mensagem de P04 no histórico, ID/status atuais e nenhum novo envio | Pendente |
| N01 | Ownership impede acesso/envio da outra Conta | Pendente |
| N02 | API nega grant revogado, sem credencial alternativa | Pendente |
| N03 | Canal ou janela não suportados impedem o envio | Pendente |

Guardar resultados com data, versão/commit do candidato, ambiente, evidência
sanitizada de chamadas e observação do efeito no destino controlado. Não marcar
casos como aprovados pela mera passagem de testes unitários. A gravação precisa
mostrar os casos e a funcionalidade real; a URL deve ser acessível ao revisor.
**Vídeo obrigatório pendente; nenhuma URL foi inventada.**

No portal, os casos são importados do ZIP. Alterações nos casos exigem atualizar
o manifesto e reenviar o ZIP. O ensaio não autoriza upload, submissão ou publicação.
