// Node.js sunucu çalışma zamanı (API route'lar, Server Component'ler) için —
// bkz. instrumentation.ts, register()'dan çağrılır. DSN yoksa init() hiç
// çalışmaz, SDK sessizce pasif kalır.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
