import { test, expect, request as playwrightRequest } from "@playwright/test";
import { hashPassword } from "../lib/server/auth/password";
import { SEED_ACCOUNTS, setKnownPassword, resetToFirstLogin, clearLoginState } from "./helpers/test-db";

// FAZ 1'de kapatılan IDOR açıklarının UÇTAN UCA (gerçek HTTP + gerçek DB)
// regresyon testi — session-guard.ts'in davranışını API seviyesinde
// doğrular: doğru sahiplik başarılı, çapraz erişim İSE 403/404 (asla 200).
const teacher = SEED_ACCOUNTS.teacher;
const student = SEED_ACCOUNTS.student;
const PASSWORD = "IdorTestSifre123";

// Öğretmenin sahibi OLMADIĞI, seed verisinde başka bir şubede bulunan bir
// öğrenci — prisma/seed.ts'teki roster'dan (İrfan Hoca'nın ders vermediği
// bir şube: "5a").
const UNRELATED_STUDENT_ID = "5a-3";

test.describe("IDOR koruması (session-guard.ts) — gerçek API'ye karşı", () => {
  test.beforeAll(async () => {
    await setKnownPassword("teacher", teacher.id, await hashPassword(PASSWORD));
  });

  test.afterAll(async () => {
    await resetToFirstLogin("teacher", teacher.id);
    await clearLoginState(teacher.phone);
  });

  test("öğretmen kendi öğrencisine erişebilir, ilişkisiz öğrenciye erişemez, yönetici uçlarına erişemez", async () => {
    const api = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" });

    const loginRes = await api.post("/api/auth/login", {
      data: { phone: teacher.phone, password: PASSWORD, expectedRole: teacher.role },
    });
    expect(loginRes.ok()).toBe(true);

    // Kendi (danışman/branş) öğrencisi — erişim başarılı olmalı.
    const ownStudentRes = await api.get(`/api/students/${student.id}`);
    expect(ownStudentRes.status()).toBe(200);

    // İlişkisiz bir öğrenci — "var ama erişemiyorsun" (403) DEĞİL,
    // "kayıt bulunamadı" (404) dönmeli (varlık sızdırmama davranışı).
    const unrelatedRes = await api.get(`/api/students/${UNRELATED_STUDENT_ID}`);
    expect(unrelatedRes.status()).toBe(404);

    // Yönetici-özel bir uç — öğretmen rolüyle 403 dönmeli.
    const adminOnlyRes = await api.get("/api/admin/dashboard");
    expect(adminOnlyRes.status()).toBe(403);

    await api.dispose();
  });

  test("oturumsuz istek 401 döner", async () => {
    const api = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" });
    const res = await api.get(`/api/students/${student.id}`);
    expect(res.status()).toBe(401);
    await api.dispose();
  });
});
