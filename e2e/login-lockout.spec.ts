import { test, expect } from "@playwright/test";
import { hashPassword } from "../lib/server/auth/password";
import { SEED_ACCOUNTS, setKnownPassword, resetToFirstLogin, clearLoginState } from "./helpers/test-db";

// Şifreli girişte 5 art arda hatalı denemeden sonra hesabın kilitlenmesinin
// UÇTAN UCA testi (bkz. lib/server/auth/rate-limit.ts > MAX_FAILED_LOGINS).
const account = SEED_ACCOUNTS.teacher;
const REAL_PASSWORD = "DogruSifre123";

test.describe("Şifreli giriş kilidi", () => {
  test.beforeEach(async () => {
    await setKnownPassword("teacher", account.id, await hashPassword(REAL_PASSWORD));
    await clearLoginState(account.phone);
  });

  test.afterEach(async () => {
    await resetToFirstLogin("teacher", account.id);
    await clearLoginState(account.phone);
  });

  test("5 hatalı şifre denemesinden sonra hesap kilitlenir", async ({ page }) => {
    await page.goto(`/login?role=${account.role}`);
    await page.getByPlaceholder("0555 000 00 00").fill(account.phone);
    await page.getByRole("button", { name: "Devam Et" }).click();

    // Hesabın zaten bir şifresi olduğu için akış doğrudan şifre adımına
    // geçer (bkz. app/login/page.tsx > START_NEEDS_PASSWORD).
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();

    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.getByPlaceholder("••••••••").fill("YanlisSifre000");
      await page.getByRole("button", { name: "Giriş Yap", exact: true }).click();
      await expect(page.getByText(/telefon veya şifre hatalı/i)).toBeVisible();
    }

    // 6. deneme — doğru şifreyle bile artık kilitli olmalı.
    await page.getByPlaceholder("••••••••").fill(REAL_PASSWORD);
    await page.getByRole("button", { name: "Giriş Yap", exact: true }).click();
    await expect(page.getByText(/kilit|dakika|bekleyin/i)).toBeVisible();
  });
});
