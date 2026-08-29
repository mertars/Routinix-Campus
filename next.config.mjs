// Content-Security-Policy BURADA YOK — nonce üretmesi gerektiği için
// (bkz. middleware.ts > buildCsp) istek başına çalışması gerekiyor; bu
// dosyadaki statik headers() yalnızca sunucu başlangıcında bir kez
// hesaplanır ve her isteğe AYNI değeri verir, bu yüzden CSP tamamen
// middleware'e taşındı.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Sadece üretimde: yerel http geliştirmede tarayıcı zaten yok sayar, ama
  // yine de dev deneyimini bulandırmasın diye burada da koşulla sınırlanıyor.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bu paketler sadece sunucu tarafında (API route'larda) kullanılıyor —
  // webpack'in bunları client bundle'a dahil etmeye çalışıp gereksiz
  // uyarılar üretmesini önlemek için native Node 'require' ile yükletiyoruz.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
    // instrumentation.ts > register()'ın (env doğrulama fail-fast'i) her
    // süreç başlangıcında çalışması için gerekli (Next.js 15'te varsayılan
    // hale geldi, 14.x'te hâlâ bu flag'in açık olmasını istiyor).
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
