import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Next.js .env.local'ı kendi başlangıcında otomatik yükler ama Playwright'ın
// test süreci Next.js'in dışında çalıştığı için (bkz. e2e/helpers/test-db.ts
// > testPrisma) bunu burada elle yapmak gerekir — aksi halde DATABASE_URL
// tanımsız kalır (bkz. prisma/seed.ts'teki aynı desen).
config({ path: ".env.local" });

// Uçtan uca (e2e) testler GERÇEK bir veritabanına karşı çalışır — CI'da
// (bkz. .github/workflows/ci.yml) bu, iş akışının kendi kurduğu geçici bir
// Postgres servis container'ıdır (migrate+seed edilmiş); yerel geliştirmede
// DATABASE_URL neyi gösteriyorsa onun karşısında çalışır. Bu yüzden e2e
// testleri ASLA gerçek/üretime yakın bir veritabanına karşı CI dışında
// otomatik çalıştırılmamalı — bkz. README'deki "Testler" bölümü.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Yerelde ZATEN çalışan bir dev sunucusu varsa onu kullan — rakip ikinci
    // bir instance başlatmak .next önbelleğini bozabilir (bu oturumda daha
    // önce yaşanan gerçek bir sorun). CI'da hiçbir zaman true olmaz, orada
    // her çalıştırma temiz bir sunucu bekler.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
