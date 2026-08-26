import { checkGeneralRateLimit, extractClientIp, MAX_REQUESTS_PER_USER } from "@/lib/server/rate-limit/general-rate-limit";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/server/auth/jwt";

// Request'in Cookie header'ından oturum çerezini elle ayrıştırıp doğrular —
// bu wrapper next/headers'ın cookies() API'sini kullanamaz (route context'i
// dışında, TÜM route'lar için tek noktadan çalışır), bu yüzden ham Request
// üzerinden okur. Süresi dolmuş/geçersiz bir çerez sessizce yok sayılır —
// rate limit burada auth'un yerini almaz, sadece EK bir sinyaldir.
async function extractSessionUserId(request: Request | undefined): Promise<string | null> {
  const cookieHeader = request?.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const payload = await verifySessionToken(decodeURIComponent(match[1]));
  return payload?.sub ?? null;
}

// Merkezi, yapılandırılmış (structured) logger. Gerçek üretimde bu dosyanın
// gövdesi bir log toplama servisine (Datadog/Sentry/CloudWatch vb.) yazacak
// şekilde değiştirilebilir — çağıran kodun (API route'lar) geri kalanı
// değişmeden kalır; SMS sağlayıcı ve görsel depolama modüllerindeki
// "swap the body, keep the interface" deseniyle aynı yaklaşım.
type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function write(level: LogLevel, message: string, fields?: LogFields) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // DSN tanımlıysa (bkz. sentry.*.config.ts) hata seviyesindeki her log
  // Sentry'ye de iletilir. DSN yoksa bu paket zaten hiç init edilmemiştir —
  // captureMessage o durumda sessizce hiçbir şey yapmaz (SDK'nın kendi
  // güvenli varsayılan davranışı), bu yüzden burada ayrıca bir kontrole
  // gerek yok.
  if (level === "error") {
    void import("@sentry/nextjs")
      .then((Sentry) => Sentry.captureMessage(message, { level: "error", extra: fields }))
      .catch(() => {
        // Sentry paketi bir sebeple yüklenemezse loglamanın kendisi
        // ASLA bundan etkilenmemeli.
      });
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};

// API route handler'larını sarmalayıp her isteği (yöntem, yol, süre, HTTP
// kodu) ve beklenmeyen hataları otomatik loglayan yardımcı. Route'ların
// kendi try-catch'i hâlâ kendi hata mesajlarını üretir; bu sarmalayıcı
// sadece gözlemlenebilirlik (observability) katmanı ekler.
export function withApiLogging<Args extends unknown[]>(
  routeLabel: string,
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    const startedAt = Date.now();
    const request = args[0] as Request | undefined;
    const method = request?.method ?? "UNKNOWN";
    const url = request instanceof Request ? request.url : undefined;

    // Genel (kaba) rate limit — TÜM route'ları tek noktadan kapsar (bkz.
    // general-rate-limit.ts). Auth route'larının kendi ince taneli
    // limitleri (OTP cooldown, login lockout) buna EK olarak çalışmaya
    // devam eder, bu sadece bir alt sınır güvenlik ağıdır. İki ayrı anahtar
    // kontrol edilir: IP (aynı okul/kurum NAT'ı arkasındaki onlarca gerçek
    // kullanıcıyı desteklemesi için YÜKSEK tutulur) ve — oturum çerezi
    // varsa — kullanıcı id'si (paylaşılan/rotating bir IP arkasından tek
    // bir hesabın kötüye kullanımını da yakalar).
    const clientIp = extractClientIp(request);
    const ipRateLimit = checkGeneralRateLimit(`ip:${clientIp}`);
    const userId = await extractSessionUserId(request);
    const userRateLimit = userId ? checkGeneralRateLimit(`user:${userId}`, MAX_REQUESTS_PER_USER) : null;
    const rateLimit = !ipRateLimit.allowed ? ipRateLimit : userRateLimit && !userRateLimit.allowed ? userRateLimit : null;
    if (rateLimit) {
      logger.warn("api_rate_limited", { route: routeLabel, method, url, clientIp, userId });
      return new Response(JSON.stringify({ error: "Çok fazla istek. Lütfen birkaç saniye sonra tekrar deneyin." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(rateLimit.retryAfterSeconds) },
      });
    }

    try {
      const response = await handler(...args);
      logger.info("api_request", {
        route: routeLabel,
        method,
        url,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      logger.error("api_unhandled_error", {
        route: routeLabel,
        method,
        url,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  };
}
