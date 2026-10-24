import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Rede de segurança: `os.homedir()` pode ignorar `process.env.HOME` (pool do
// Stryker, por exemplo), então nenhum teste depende do HOME para achar o config.
// Os arquivos que isolam por caso sobrescrevem este diretório e o restauram.
process.env.BOTOZAP_CONFIG_DIR = mkdtempSync(join(tmpdir(), "botozap-cli-config-"));
