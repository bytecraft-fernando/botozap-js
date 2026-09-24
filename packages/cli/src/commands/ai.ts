import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { Command } from "commander";
import { AI_OPERATIONS } from "@botozap/sdk";
import { operation } from "./attendance.js";
const kebab = (value: string) =>
  value.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
/** Every command maps to one declared /ai endpoint; inputs preserve exact revisions. */
export function registerAi(program: Command) {
  const root = program
    .command("ai")
    .description(
      "IA BYOK: agentes, bibliotecas, roteamento e operação; agents:read/write",
    );
  operation(
    root,
    "conversation-control <id>",
    "Pausa/retoma agente na conversa; resume pode gerar respostas.",
    (client, id, input) =>
      client.conversations.controlAgent(
        id!,
        input.action as "pause" | "resume",
      ),
    ["action"],
  );
  for (const group of new Set(AI_OPERATIONS.map((o) => o.group))) {
    const command = root
      .command(kebab(group))
      .description(`Operações de ${group}`);
    for (const op of AI_OPERATIONS.filter((o) => o.group === group)) {
      const required = Object.entries(op.fields)
        .filter(([, v]) => !v.optional)
        .map(([k]) => k);
      const fields =
        op.shape === "multipart"
          ? required
              .filter((k) => k !== "file" && k !== "file_name")
              .concat("file_path")
          : required;
      operation(
        command,
        kebab(op.name),
        `${op.method} ${op.path}. ${op.description} Campos: ${Object.keys(
          op.fields,
        )
          .filter((k) => k !== "file")
          .join(
            ", ",
          )}${op.shape === "multipart" ? ", file_path (arquivo local)" : ""}.`,
        async (client, _id, raw) => {
          const input = { ...raw };
          if (op.shape === "multipart") {
            const path = String(input.file_path);
            const limit =
              op.group === "skills" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
            const size = (await stat(path)).size;
            if (!size || size > limit)
              throw new Error("Arquivo vazio ou acima do limite de upload.");
            const bytes = await readFile(path);
            if (!bytes.length || bytes.length > limit)
              throw new Error("Arquivo vazio ou acima do limite de upload.");
            delete input.file_path;
            input.file = new Blob([bytes], {
              type:
                typeof input.mime_type === "string"
                  ? input.mime_type
                  : /\.pdf$/i.test(String(input.file_name ?? path))
                    ? "application/pdf"
                    : "application/octet-stream",
            });
            delete input.mime_type;
            input.file_name ??= basename(path);
          }
          return client.ai.invoke(group, op.name, input);
        },
        fields,
        {
          maxBytes: 1024 * 1024,
          validate(input) {
            for (const [name, field] of Object.entries(op.fields)) {
              const value = input[name];
              if (value === undefined) continue;
              if (
                field.type === "configurablePurpose" &&
                ![
                  "default",
                  "followup",
                  "proposal",
                  "transcription",
                  "embedding",
                ].includes(String(value))
              )
                throw new Error(
                  "Esta finalidade é configurada na versão do agente ou no roteador.",
                );
              if (
                field.type === "revision" &&
                (typeof value !== "string" || !/^\d+$/.test(value))
              )
                throw new Error(
                  `${name} deve ser a string de revisão recebida da API.`,
                );
              if (
                field.type === "number" &&
                (typeof value !== "number" || !Number.isFinite(value))
              )
                throw new Error(`${name} deve ser número.`);
              if (field.type === "true" && value !== true)
                throw new Error(`${name} exige confirmação true.`);
            }
          },
        },
      );
    }
  }
}
