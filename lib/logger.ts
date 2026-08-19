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
