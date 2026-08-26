// Next.js'in resmi "sunucu başlangıcı" kancası — her Node.js işlemi (dev
// sunucusu, `next start`, her yeni serverless soğuk-başlangıç) ayağa
// kalkarken TAM OLARAK BİR KEZ çalışır. Ortam değişkeni doğrulamasının
// (bkz. lib/server/env.ts) "boot'ta fail-fast" olması için tek doğru yer
// burasıdır — bir route handler'ın İÇİNDE çağrılırsa sadece o isteği,
// sunucunun kendisini değil, hatalı yapılandırmayla ayakta tutardı.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("./lib/server/env");
    getEnv();
    await import("./sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js'in App Router'da yakaladığı ama başka türlü kaybolan sunucu tarafı
// render/action hatalarını Sentry'ye iletir (DSN tanımlıysa — bkz. sentry.*.config.ts).
export async function onRequestError(...args: Parameters<NonNullable<typeof import("@sentry/nextjs").captureRequestError>>) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }
}
