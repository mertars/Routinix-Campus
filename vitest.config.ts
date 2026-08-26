import { defineConfig } from "vitest/config";

// Sadece BİRİM testleri (saf mantık: guard/rol eşleme/rate-limit) — gerçek
// bir veritabanı veya sunucu gerektirmez, bkz. vitest.setup.ts. Uçtan uca
// akışlar (login/OTP/lockout/IDOR-engelleme) Playwright'ta (bkz.
// playwright.config.ts) gerçek bir DB'ye karşı test edilir.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
  },
});
