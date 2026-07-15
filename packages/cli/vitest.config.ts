import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `picocolors` resolve o suporte a cor UMA VEZ, no import, e LIGA a cor
    // quando `process.env.CI` está setado — mesmo sem TTY. No GitHub Actions
    // isso injeta ANSI no meio da saída humana (`\e[1mid\e[22m  ct_1`) e quebra
    // asserções de layout como /id\s+ct_1/: verde na máquina do dev, vermelho
    // no CI. Forçar NO_COLOR deixa a saída humana determinística em qualquer
    // ambiente — é o mesmo motivo pelo qual os testes que dão spawn
    // (process.test.ts / secret.test.ts) já setam NO_COLOR no env do filho.
    // Nenhum teste depende de cor LIGADA; quem for testar cor deve ligá-la
    // explicitamente no próprio caso.
    env: { NO_COLOR: "1" },
  },
});
