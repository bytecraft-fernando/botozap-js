import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { registerAttendance } from "../src/commands/attendance.js";
import { registerAgenda } from "../src/commands/agenda.js";
import { run } from "./helpers.js";
let directory: string;
const fetch = vi.fn();
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "botozap-attendance-"));
  fetch
    .mockReset()
    .mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "record" } })),
    );
  vi.stubGlobal("fetch", fetch);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});
async function invoke(command: string[], input: unknown, agenda = false) {
  const path = join(directory, "input.json");
  await writeFile(path, JSON.stringify(input));
  return run(agenda ? registerAgenda : registerAttendance, [
    ...command,
    "--input-file",
    path,
    "--api-key",
    "bz_live_unit",
    "--api-url",
    "https://api.test/v1",
    "-o",
    "json",
  ]);
}
it("arquivo JSON preserva CAS com microssegundos, null e UTF8", async () => {
  const input = {
    expected_updated_at: "2026-09-22T03:05:06.123456Z",
    title: "Olá",
    shortcut: null,
  };
  const result = await invoke(["saved-replies", "update", "reply"], input);
  expect(result.error).toBeUndefined();
  expect(JSON.parse(result.stdout)).toEqual({ id: "record" });
  expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual(input);
});
it("mutation sem versão e JSON não objeto falham sem acessar API", async () => {
  for (const input of [{ title: "Sem CAS" }, [], null]) {
    const result = await invoke(["saved-replies", "update", "reply"], input);
    expect(result.error).toBeDefined();
  }
  expect(fetch).not.toHaveBeenCalled();
});
it("zero não é versão válida para edição", async () => {
  const result = await invoke(["demands", "update", "demand"], {
    expected_version: 0,
    title: "Edite",
  });
  expect(result.error).toBeDefined();
  expect(fetch).not.toHaveBeenCalled();
});
it("Régua usa PUT completo e não PATCH", async () => {
  const input = {
    customer_id: "customer",
    name: "Retorno",
    steps: [{ template_id: "t", delay_minutes: 0 }],
    version: 2,
  };
  const result = await invoke(["journeys", "update", "journey"], input);
  expect(result.error).toBeUndefined();
  expect(fetch.mock.calls[0][1].method).toBe("PUT");
  expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual(input);
});
it("Agenda DELETE exceção transmite revisão no JSON", async () => {
  fetch.mockResolvedValue(new Response(null, { status: 204 }));
  const result = await invoke(
    ["appointments", "exceptions", "delete", "exception"],
    { expected_revision: 4 },
    true,
  );
  expect(result.error).toBeUndefined();
  expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toEqual({
    expected_revision: 4,
  });
  expect(JSON.parse(result.stdout)).toEqual({ success: true });
});
