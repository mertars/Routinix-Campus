import { z } from "zod";

// Geliştirmede JWT imzalamanın hiç kırılmaması için kullanılan sabit yedek —
// SADECE development/test'te izin verilir (bkz. getEnv altta). Üretimde bu
// değerin kullanılması AUTH_SECRET eksik/geçersizse boot anında engellenir.
export const DEV_FALLBACK_AUTH_SECRET = "routinix-kampus-dev-secret-change-me-0000";

// Barındırma panellerinin (Vercel vb.) Environment Variables alanı DÜZ METİN
// bekler — ama .env.example/.env.local.example dosyalarımızda örnekler
// SMS_PROVIDER="mock" gibi TIRNAKLI gösterilir (.env dosya sözdizimi
// gereği). Biri bu tırnakları birebir kopyalayıp panele yapıştırırsa değer
// gerçekte 'mock' değil '"mock"' olur ve enum'a uymaz — üretimde tam olarak
// bu yaşandı, hata mesajı hangi değerin geldiğini göstermediği için teşhis
// birkaç round-trip sürdü. Burada baştan (trim + çevreleyen tırnak
// temizliği) toleranslı davranılır; aşağıdaki getEnv() de artık alınan HAM
// değeri hata mesajına ekler.
const stripQuotes = (val: unknown) => (typeof val === "string" ? val.trim().replace(/^["']|["']$/g, "") : val);

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL zorunludur (bkz. .env.local.example)."),
  AUTH_SECRET: z.string().optional(),
  SMS_PROVIDER: z.preprocess(stripQuotes, z.enum(["mock", "netgsm", "mutlusms", "generic"])).default("mock"),
});

export type Env = z.infer<typeof baseSchema> & { AUTH_SECRET: string };

let cached: Env | null = null;

// Uygulamanın TÜM zorunlu ortam değişkenlerini tek noktadan, boot anında
// doğrular — eksik/geçersiz bir değerle "yarı çalışan" bir sunucu ayağa
// kalkmaz (bkz. instrumentation.ts > register(), her Node işlemi
// başlangıcında bunu çağırır). Sonuç process ömrü boyunca önbelleklenir.
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = baseSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => {
        const key = i.path.join(".");
        const rawValue = process.env[key];
        return `  - ${key}: ${i.message} (alınan ham değer: ${rawValue === undefined ? "tanımsız" : JSON.stringify(rawValue)})`;
      })
      .join("\n");
    throw new Error(`Ortam değişkenleri geçersiz, sunucu başlatılamıyor:\n${issues}`);
  }

  let authSecret = parsed.data.AUTH_SECRET;
  if (parsed.data.NODE_ENV === "production") {
    // Üretimde zayıf/eksik bir AUTH_SECRET ile sessizce ayağa kalkmak —
    // herkesin bildiği bir dev-secret'la oturum token'ı imzalamak demektir.
    // Bu, "çalışıyor ama güvensiz" yerine "hiç çalışmıyor" tercih edilen
    // klasik fail-fast durumu.
    if (!authSecret || authSecret.length < 32) {
      throw new Error(
        "AUTH_SECRET üretimde zorunludur ve en az 32 karakter olmalıdır. " +
          "Rastgele güçlü bir değer üretin (örn. `openssl rand -base64 48`) ve barındırma ortamınızda tanımlayın."
      );
    }
  } else if (!authSecret) {
    // Dev/test'te sabit bir yedekle devam edilir ama sessizce değil —
    // konsola bir kere uyarı yazılır.
    console.warn(
      "[env] AUTH_SECRET tanımlı değil — geliştirme yedeği kullanılıyor. Üretimde bu bir boot hatasıdır."
    );
    authSecret = DEV_FALLBACK_AUTH_SECRET;
  }

  cached = { ...parsed.data, AUTH_SECRET: authSecret };
  return cached;
}
