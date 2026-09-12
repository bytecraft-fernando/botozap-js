import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyManifest(manifest, expected) {
  assert.equal(manifest.name, expected.name, "nome do pacote incorreto");
  assert.equal(manifest.version, expected.version, "versão do pacote incorreta");
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      assert.equal(typeof spec, "string", `${field}.${name}: versão ausente`);
      assert(!/^(workspace:|file:|link:|catalog:|\.\.?\/|\/)/.test(spec),
        `${field}.${name}: referência local no pacote publicado`);
    }
  }
  for (const [name, version] of Object.entries(expected.internalDependencies ?? {})) {
    assert.equal(manifest.dependencies?.[name], version,
      `${name}: o tarball precisa fixar a versão do workspace`);
  }
}

export function verifyTarball(archive, sourceManifest, sdkManifest) {
  const manifest = JSON.parse(execFileSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" }));
  const source = JSON.parse(readFileSync(sourceManifest, "utf8"));
  const sdk = JSON.parse(readFileSync(sdkManifest, "utf8"));
  verifyManifest(manifest, {
    name: source.name,
    version: source.version,
    internalDependencies: source.dependencies?.[sdk.name] ? { [sdk.name]: sdk.version } : {},
  });
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [archive, source, sdk] = process.argv.slice(2);
  if (!archive || !source || !sdk) throw new Error("Uso: verify-package.mjs tarball package.json sdk/package.json");
  const manifest = verifyTarball(archive, source, sdk);
  console.log(`tarball validado: ${manifest.name}@${manifest.version}`);
}
