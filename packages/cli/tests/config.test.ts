/**
 * Configuração e resolução de credenciais (`src/config.ts` + `src/client.ts`).
 *
 * Cobre: arquivo ausente, JSON inválido tolerado, ausência de chave = erro
 * LOCAL sem rede, precedência tripla (flag > env > arquivo) para apiKey E
 * baseUrl simultâneas, normalização de barras finais, e as permissões do
 * arquivo no disco (0600/0700 e endurecimento de um legado 0644).
 */
import { chmodSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { ConfigError } from "../src/client.js";
import {
  resolveAuth,
  readConfig,
  setConfigValue,
  configPath,
  configDir,
} from "../src/config.js";
import { registerMessages } from "../src/commands/messages.js";
import { run } from "./helpers.js";

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_KEY_ENV = process.env.BOTOZAP_API_KEY;
const ORIGINAL_URL_ENV = process.env.BOTOZAP_API_URL;
let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "botozap-cli-cfg-"));
  process.env.HOME = home;
  delete process.env.BOTOZAP_API_KEY;
  delete process.env.BOTOZAP_API_URL;
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  restore("HOME", ORIGINAL_HOME);
  restore("BOTOZAP_API_KEY", ORIGINAL_KEY_ENV);
  restore("BOTOZAP_API_URL", ORIGINAL_URL_ENV);
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("leitura do config em disco", () => {
  it("arquivo ausente → objeto vazio, sem chave", () => {
    expect(readConfig()).toEqual({});
    expect(resolveAuth({}).apiKey).toBeUndefined();
    expect(resolveAuth({}).apiKeySource).toBe("none");
  });

  it("JSON inválido é tolerado como vazio (não quebra)", () => {
    mkdirSync(configDir(), { recursive: true, mode: 0o700 });
    writeFileSync(configPath(), "{ isto não é json", { mode: 0o600 });
    expect(readConfig()).toEqual({});
    expect(resolveAuth({}).apiKey).toBeUndefined();
  });

  it("JSON válido mas não-objeto (array) → vazio", () => {
    mkdirSync(configDir(), { recursive: true, mode: 0o700 });
    writeFileSync(configPath(), "[1,2,3]", { mode: 0o600 });
    expect(readConfig()).toEqual([1, 2, 3] as never);
    // (readConfig devolve o array cru; resolveAuth ignora por não ter apiKey)
    expect(resolveAuth({}).apiKey).toBeUndefined();
  });

  it("config sem a chave apiKey mas com baseUrl", () => {
    setConfigValue("baseUrl", "https://custom.example/api/v1");
    const auth = resolveAuth({});
    expect(auth.apiKey).toBeUndefined();
    expect(auth.baseUrl).toBe("https://custom.example/api/v1");
  });
});

describe("ausência de chave = erro LOCAL sem rede", () => {
  it("`messages list` sem chave lança ConfigError e nunca toca a rede", async () => {
    // HOME isolado e vazio, sem env, sem flag. Se tentasse rede, o erro seria
    // de conexão (network_error) — aqui exigimos ConfigError puramente local.
    const { error } = await run(registerMessages, ["messages", "list"]);
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).message).toContain("API key");
  });
});

describe("precedência tripla flag > env > arquivo (apiKey e baseUrl juntas)", () => {
  it("arquivo é a base para ambas", () => {
    setConfigValue("apiKey", "bz_live_fromfile");
    setConfigValue("baseUrl", "https://file.example/api/v1");
    const auth = resolveAuth({});
    expect(auth.apiKey).toBe("bz_live_fromfile");
    expect(auth.apiKeySource).toBe("config");
    expect(auth.baseUrl).toBe("https://file.example/api/v1");
  });

  it("env sobrepõe arquivo para ambas", () => {
    setConfigValue("apiKey", "bz_live_fromfile");
    setConfigValue("baseUrl", "https://file.example/api/v1");
    process.env.BOTOZAP_API_KEY = "bz_live_fromenv";
    process.env.BOTOZAP_API_URL = "https://env.example/api/v1";
    const auth = resolveAuth({});
    expect(auth.apiKey).toBe("bz_live_fromenv");
    expect(auth.apiKeySource).toBe("env");
    expect(auth.baseUrl).toBe("https://env.example/api/v1");
  });

  it("flag sobrepõe env E arquivo para ambas, simultaneamente", () => {
    setConfigValue("apiKey", "bz_live_fromfile");
    setConfigValue("baseUrl", "https://file.example/api/v1");
    process.env.BOTOZAP_API_KEY = "bz_live_fromenv";
    process.env.BOTOZAP_API_URL = "https://env.example/api/v1";
    const auth = resolveAuth({
      apiKey: "bz_live_fromflag",
      apiUrl: "https://flag.example/api/v1",
    });
    expect(auth.apiKey).toBe("bz_live_fromflag");
    expect(auth.apiKeySource).toBe("flag");
    expect(auth.baseUrl).toBe("https://flag.example/api/v1");
  });

  it("--api-url e BOTOZAP_API_URL ao mesmo tempo → flag vence", () => {
    process.env.BOTOZAP_API_URL = "https://env.example/api/v1";
    expect(resolveAuth({ apiUrl: "https://flag.example/api/v1" }).baseUrl).toBe(
      "https://flag.example/api/v1",
    );
  });
});

describe("normalização de barras finais no baseUrl", () => {
  it("remove múltiplas barras finais", () => {
    expect(resolveAuth({ apiUrl: "https://x.example/api/v1///" }).baseUrl).toBe(
      "https://x.example/api/v1",
    );
  });

  it("aplica também ao valor vindo do env e do arquivo", () => {
    process.env.BOTOZAP_API_URL = "https://env.example/api/v1//";
    expect(resolveAuth({}).baseUrl).toBe("https://env.example/api/v1");
    delete process.env.BOTOZAP_API_URL;
    setConfigValue("baseUrl", "https://file.example/api/v1////");
    expect(resolveAuth({}).baseUrl).toBe("https://file.example/api/v1");
  });

  it("default quando nada informado", () => {
    expect(resolveAuth({}).baseUrl).toBe("https://botozap.com.br/api/v1");
  });
});

describe("permissões do config em disco", () => {
  it.skipIf(process.platform === "win32")(
    "grava config.json 0600 e o diretório 0700",
    () => {
      setConfigValue("apiKey", "bz_live_secret_perm");
      expect(statSync(configPath()).mode & 0o777).toBe(0o600);
      expect(statSync(configDir()).mode & 0o777).toBe(0o700);
    },
  );

  it.skipIf(process.platform === "win32")(
    "endurece um arquivo legado 0644 para 0600 ANTES de gravar o segredo",
    () => {
      // Cria o arquivo FORA da CLI, frouxo (0644), simulando um legado.
      mkdirSync(configDir(), { recursive: true, mode: 0o700 });
      writeFileSync(configPath(), JSON.stringify({ baseUrl: "x" }), {
        mode: 0o644,
      });
      chmodSync(configPath(), 0o644);
      expect(statSync(configPath()).mode & 0o777).toBe(0o644);

      // Agora o fluxo de gravação da CLI deve endurecer para 0600.
      setConfigValue("apiKey", "bz_live_secret_legacy");
      expect(statSync(configPath()).mode & 0o777).toBe(0o600);
      expect(readConfig().apiKey).toBe("bz_live_secret_legacy");
    },
  );
});
