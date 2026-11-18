---
"@botozap/sdk": minor
"@botozap/mcp": minor
"@botozap/cli": minor
---

Regra da etapa: `ContactStage` ganha `on_reply_stage_id`, a etapa para onde o contato vai quando manda mensagem estando nela (`null` não move). `contactStages.update`, a ferramenta `update_contact_stage` e `botozap contact-stages update` aceitam o campo: outra etapa do mesmo Cliente, ou `null` para desligar. Reação, figurinha, só emoji ou só cortesia não movem o contato.
