// dotenv/config'in varsayılanı sadece .env'i okur; bu projede Next.js
// konvensiyonuna uyup .env.local kullanıyoruz, o yüzden yolu açıkça veriyoruz.
import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "prisma/config";

// Prisma 7: CLI komutları (migrate/studio/introspect) bağlantıyı buradan
// alır. Çalışma zamanındaki PrismaClient ise ayrı olarak
// lib/server/prisma.ts'teki '@prisma/adapter-pg' driver adapter'ından alır.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  // Prisma 7: seed komutu artık package.json > "prisma"."seed" değil, burada
  // tanımlanıyor. package.json'daki alanı da (başka araçlar/dokümantasyon
  // onu okuyabildiği için) geriye dönük uyumluluk amacıyla bıraktık.
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
