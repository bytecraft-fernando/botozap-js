import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyManifest } from "./verify-package.mjs";

const expected = { name: "@botozap/mcp", version: "0.2.6", internalDependencies: { "@botozap/sdk": "0.3.2" } };
const valid = { name: expected.name, version: expected.version, dependencies: { "@botozap/sdk": "0.3.2" } };

test("recusa a regressão 0.2.5 antes que overrides escondam workspace:*", () => {
  assert.throws(() => verifyManifest({ ...valid, dependencies: { "@botozap/sdk": "workspace:*" } }, expected), /referência local/);
});
test("aceita dependência publicada e recusa versão interna divergente", () => {
  verifyManifest(valid, expected);
  assert.throws(() => verifyManifest({ ...valid, dependencies: { "@botozap/sdk": "0.3.1" } }, expected), /fixar a versão/);
});
test("recusa dependências locais também em optional e peer dependencies", () => {
  for (const field of ["optionalDependencies", "peerDependencies"]) {
    for (const spec of ["workspace:^", "file:../sdk", "link:../sdk", "catalog:", "../sdk", "/tmp/sdk"]) {
      assert.throws(() => verifyManifest({ ...valid, [field]: { other: spec } }, expected), /referência local/);
    }
  }
});
test("recusa tarball de outra versão ou outro pacote", () => {
  assert.throws(() => verifyManifest({ ...valid, version: "0.2.5" }, expected), /versão/);
  assert.throws(() => verifyManifest({ ...valid, name: "@botozap/cli" }, expected), /nome/);
});
