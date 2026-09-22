import { z } from "zod";
import type { StageColor, ContactField } from "@botozap/sdk";
import { emptyOperationResult, type Register } from "../register.js";
const uuid = z.string().uuid(),
  customer_id = uuid.optional(),
  label = z.string().min(1).max(60),
  color = z.enum(["zinc", "green", "amber", "pink"]),
  row = z
    .object({
      id: uuid,
      key: z.string(),
      label: z.string(),
      position: z.number(),
    })
    .passthrough(),
  item = z.object({ data: row }),
  list = z.object({ data: z.array(row) }),
  success = z.object({ success: z.literal(true) });
export function registerContactConfigurationTools(register: Register) {
  register(
    "list_contact_stages",
    "Descobre etapas do funil por Cliente. Omitir customer_id só em Conta com exatamente um Cliente; contacts:read.",
    { customer_id },
    list,
    async (c, a) => ({ data: await c.contactStages.list(a) }),
  );
  register(
    "create_contact_stage",
    "Cria etapa do funil; contacts:write.",
    { customer_id, label, color },
    item,
    async (c, a) => ({
      data: await c.contactStages.create(
        a as { label: string; color: StageColor },
      ),
    }),
  );
  register(
    "update_contact_stage",
    "Edita etapa do Cliente; contacts:write.",
    {
      id: uuid,
      customer_id,
      label: label.optional(),
      color: color.optional(),
      position: z.number().int().positive().optional(),
    },
    item,
    async (c, a) => {
      const { id, ...p } = a;
      return { data: await c.contactStages.update(String(id), p) };
    },
  );
  register(
    "delete_contact_stage",
    "Exclui etapa do Cliente; contacts:write.",
    { id: uuid, customer_id },
    success,
    async (c, a) => {
      await c.contactStages.delete(String(a.id), {
        customer_id: a.customer_id as string | undefined,
      });
      return emptyOperationResult();
    },
  );
  register(
    "reorder_contact_stages",
    "Reordena todas as etapas do Cliente uma única vez; contacts:write.",
    { customer_id, stage_ids: z.array(uuid).min(1).max(50) },
    list,
    async (c, a) => ({
      data: await c.contactStages.reorder(a as { stage_ids: string[] }),
    }),
  );
  register(
    "list_contact_fields",
    "Descobre campos personalizados e tipos (inclui datas usadas nas réguas); contacts:read.",
    {},
    list,
    async (c) => ({ data: await c.contactFields.list() }),
  );
  register(
    "create_contact_field",
    "Cria definição de campo personalizado da Conta; contacts:write.",
    {
      label,
      type: z.enum(["text", "number", "boolean", "date"]).optional(),
      key: z.string().optional(),
    },
    item,
    async (c, a) => ({
      data: await c.contactFields.create(
        a as { label: string; type?: ContactField["type"] },
      ),
    }),
  );
  register(
    "update_contact_field",
    "Altera rótulo/ordem; chave e tipo permanecem imutáveis. contacts:write.",
    {
      id: uuid,
      label: label.optional(),
      position: z.number().int().positive().optional(),
    },
    item,
    async (c, a) => {
      const { id, ...p } = a;
      return { data: await c.contactFields.update(String(id), p) };
    },
  );
  register(
    "delete_contact_field",
    "Exclui definição de campo personalizado; contacts:write.",
    { id: uuid },
    success,
    async (c, a) => {
      await c.contactFields.delete(String(a.id));
      return emptyOperationResult();
    },
  );
}
