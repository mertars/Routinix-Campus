import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// ENTEGRASYON TESTLERİ — GERÇEK bir veritabanına yazar/siler.
//
// ⚠️ Yalnızca .env.test okunur; .env.local (canlı dershane veritabanı)
// BİLEREK yüklenmez. Böylece bu testler üretim adresini göremez bile.
// Ek güvenlik katmanı: lib/server/test-db.ts açılışta adresi doğrular.
config({ path: ".env.test" });

// Test edilen uygulama kodu (lib/server/prisma.ts) DATABASE_URL okur.
// Burada onu TEST adresine EŞİTLİYORUZ — böylece gerçek uygulama akışları
// (notify, emitAttendanceNotifications, servisler) test veritabanına yazar.
//
// ⚠️ Bu, üretime yazma riski YARATMAZ çünkü bu süreçte .env.local hiç
// yüklenmedi: DATABASE_URL'in tek kaynağı .env.test'teki yerel adres.
// Yine de bir kaza olasılığına karşı burada da doğruluyoruz.
const testUrl = process.env.TEST_DATABASE_URL ?? "";
if (!testUrl) {
  throw new Error("TEST_DATABASE_URL tanımsız — önce `npm run test:db:up && npm run test:db:reset`.");
}
const host = new URL(testUrl).hostname;
if (!(host === "localhost" || host === "127.0.0.1") && !/test|staging/i.test(testUrl)) {
  throw new Error(`GÜVENLİK: TEST_DATABASE_URL yerel değil (${host}) — entegrasyon testleri reddedildi.`);
}
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Testler aynı veritabanını paylaşıyor; her test kendi izole kurumunda
    // çalışsa da migration/bağlantı yarışını önlemek için tek süreç.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
