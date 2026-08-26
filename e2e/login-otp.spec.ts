import { test, expect } from "@playwright/test";
import { SEED_ACCOUNTS, resetToFirstLogin, clearLoginState, testPrisma } from "./helpers/test-db";

// İlk giriş (OTP) akışının UÇTAN UCA gerçek DB'ye karşı testi: telefon ->
// (demo modda ekranda gösterilen) OTP -> yeni şifre -> doğru panele
// yönlendirme. prisma/seed.ts'teki deterministik demo öğrenci kullanılır.
const account = SEED_ACCOUNTS.student;

test.describe("İlk giriş — OTP akışı", () => {
  test.beforeEach(async () => {
    await resetToFirstLogin("student", account.id);
    await clearLoginState(account.phone);
  });

  test.afterEach(async () => {
    await resetToFirstLogin("student", account.id);
    await clearLoginState(account.phone);
  });

  test("telefon + OTP ile ilk girişte kalıcı şifre belirlenir ve öğrenci panele yönlendirilir", async ({ page }) => {
    await page.goto(`/login?role=${account.role}`);

    await page.getByPlaceholder("0555 000 00 00").fill(account.phone);
    await page.getByRole("button", { name: "Devam Et" }).click();

    // Demo modda kod ekranda gösterilir (bkz. app/login/page.tsx > devOtp) —
    // gerçek bir SMS beklemeye gerek yok.
    const demoCode = page.locator("text=Demo Kodu").locator("..").locator("p").nth(1);
    await expect(demoCode).toBeVisible();
    const code = (await demoCode.textContent())?.trim() ?? "";
    expect(code).toMatch(/^\d{6}$/);

    const firstOtpBox = page.locator('input[inputmode="numeric"]').first();
    await firstOtpBox.click();
    await page.keyboard.type(code);

    await page.getByRole("button", { name: "Doğrula" }).click();

    await expect(page.getByText("Yeni Şifre")).toBeVisible();
    await page.getByPlaceholder("En az 6 karakter").fill("E2eTestSifre123");
    await page.getByPlaceholder("Şifreyi tekrar girin").fill("E2eTestSifre123");
    await page.getByRole("button", { name: "Şifreyi Belirle" }).click();

    await page.waitForURL("**/student");
    await expect(page).toHaveURL(/\/student/);

    // Şifrenin gerçekten kalıcı yazıldığını (mustChangePassword kapatıldığını)
    // doğrudan DB'den doğrula — sadece yönlendirmeye güvenmek yeterli değil.
    const student = await testPrisma.student.findUnique({ where: { id: account.id } });
    expect(student?.passwordHash).not.toBeNull();
    expect(student?.mustChangePassword).toBe(false);
  });
});
