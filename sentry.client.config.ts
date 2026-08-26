// Next.js'in resmi sözleşmesine göre otomatik olarak yüklenir (client bundle).
// DSN tanımlı değilse init() hiç çağrılmaz — Sentry paketi kurulu ama
// PASİF kalır, hiçbir şey göndermez/loglamaz. Gerçek bir DSN, kullanıcı
// Sentry hesabı açıp NEXT_PUBLIC_SENTRY_DSN'i tanımladığında devreye girer.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Düşük örnekleme oranı — performans izlemesi burada bir öncelik değil,
    // asıl amaç hata yakalama. Kullanıcı ihtiyaç duyarsa DSN'i tanımladıktan
    // sonra bu değeri kendi trafiğine göre artırabilir.
    tracesSampleRate: 0.1,
  });
}
