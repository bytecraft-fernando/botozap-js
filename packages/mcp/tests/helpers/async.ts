export async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 5,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error("condição não atingida");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "operação não concluída",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
