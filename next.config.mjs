/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bu paketler sadece sunucu tarafında (API route'larda) kullanılıyor —
  // webpack'in bunları client bundle'a dahil etmeye çalışıp gereksiz
  // uyarılar üretmesini (örn. handlebars'ın require.extensions kullanımı)
  // önlemek için native Node 'require' ile yükletiyoruz.
  experimental: {
    serverComponentsExternalPackages: ["handlebars", "puppeteer", "@prisma/client"],
  },
};

export default nextConfig;
