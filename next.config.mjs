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
    // PDF üretiminin (bkz. lib/server/pdf/fonts.ts) çalışma anında okuduğu
    // Noto Sans font dosyaları — Vercel'in serverless fonksiyon paketleme
    // izleyicisi (file tracing) public/ altındaki dosyaları BAZI durumlarda
    // otomatik dahil etmeyebiliyor (yerelde çalışıp üretimde "PDF açılmıyor"
    // hatasına yol açan asıl neden buydu); burada AÇIKÇA zorunlu kılınıyor.
    //
    // pdfkit/js/standard-fonts/**: @react-pdf/font'un DOĞRUDAN bağımlısı olan
    // pdfkit, PDFDocument başlatılırken varsayılan font olarak "Helvetica"yı
    // Node'un "imports" (#standard-fonts/*) alt-yol çözümlemesiyle yüklüyor —
    // bu çözümleme biçimi @vercel/nft'nin statik izlemesinde GÖRÜNMÜYOR, bu
    // yüzden "Cannot find module .../standard-fonts/Helvetica.cjs" hatasıyla
    // üretimde patlıyordu (Noto Sans KAYITLI olsa bile — pdfkit kendi iç
    // varsayılanını her PDF için önce yüklüyor). Küçük bir klasör (~180KB),
    // tamamı dahil ediliyor.
    // ⚠️ @react-pdf/renderer kullanan YENİ bir uç eklenirse buraya da eklenmeli
    // (bkz. components/pdf/ altındaki her component'in kullanıldığı route.tsx).
    outputFileTracingIncludes: {
      "/api/report-cards/**": ["./public/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
      "/api/guidance-program/**": ["./public/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
      "/api/yearly-plan/**": ["./public/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
      "/api/teacher-schedule/**": ["./public/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
      "/api/exam-seating/**": ["./public/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
      "/api/admin/users/**": ["./public/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
    },
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
