import type { Command } from "commander";
import type { StageColor, ContactField } from "@botozap/sdk";
import { operation } from "./attendance.js";
export function registerContactConfiguration(program: Command) {
  const stages = program
    .command("contact-stages")
    .description("Etapas do funil por Cliente; contacts:read/write");
  operation(
    stages,
    "list",
    "customer_id recomendado; omitir só em Conta com exatamente um Cliente",
    (c, _id, p) => c.contactStages.list(p),
  );
  operation(
    stages,
    "create",
    "label e color (zinc,green,amber,pink); customer_id recomendado",
    (c, _id, p) =>
      c.contactStages.create(p as { label: string; color: StageColor }),
    ["label", "color"],
  );
  operation(
    stages,
    "update <id>",
    "Altera label,color,position; customer_id recomendado",
    (c, id, p) => c.contactStages.update(id!, p),
  );
  operation(
    stages,
    "delete <id>",
    "Exclui etapa do Cliente; customer_id recomendado",
    (c, id, p) => c.contactStages.delete(id!, p),
  );
  operation(
    stages,
    "reorder",
    "stage_ids deve conter todas as etapas exatamente uma vez; customer_id recomendado",
    (c, _id, p) => c.contactStages.reorder(p as { stage_ids: string[] }),
    ["stage_ids"],
  );
  const fields = program
    .command("contact-fields")
    .description("Campos personalizados da Conta; contacts:read/write");
  operation(
    fields,
    "list",
    "Lista definições e tipos de campos disponíveis",
    (c) => c.contactFields.list(),
  );
  operation(
    fields,
    "create",
    "label; type text/number/boolean/date e key opcionais",
    (c, _id, p) =>
      c.contactFields.create(
        p as { label: string; type?: ContactField["type"] },
      ),
    ["label"],
  );
  operation(
    fields,
    "update <id>",
    "Altera label e position; tipo e chave são imutáveis",
    (c, id, p) => c.contactFields.update(id!, p),
  );
  operation(fields, "delete <id>", "Exclui definição do campo", (c, id) =>
    c.contactFields.delete(id!),
  );
}
