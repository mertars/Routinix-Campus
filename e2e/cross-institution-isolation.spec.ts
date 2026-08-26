import { test, expect, request as playwrightRequest } from "@playwright/test";
import { hashPassword } from "../lib/server/auth/password";
import {
  SEED_ACCOUNTS,
  createTestInstitutionWithAccounts,
  deleteTestInstitution,
  testPrisma,
} from "./helpers/test-db";

// FAZ 5 smoke-test seti: çoklu-kurum mimarisinin (bkz. FAZ 1) iki kurum
// ARASINDA hiçbir veri sızdırmadığını doğrular. Sadece "id ile doğrudan
// erişim" değil (bu FAZ 1/4'te zaten kapsandı), LİSTE uçlarının da doğru
// filtrelendiğini kontrol eder — bu, tek-kurumlu testlerin YAKALAYAMAYACAĞI
// bir sınıf hatadır (örn. bir where filtresinin unutulması sadece iki kurum
// olduğunda görünür).
const PASSWORD = "IsolationTest123";

test.describe("Kurumlar-arası izolasyon", () => {
  let institutionBId: string;
  let adminB: { id: string; institutionalMobile: string };
  let teacherB: { id: string; mobilePhone: string };

  test.beforeAll(async () => {
    const fixture = await createTestInstitutionWithAccounts("izolasyon-testi");
    institutionBId = fixture.institution.id;
    adminB = fixture.admin;
    teacherB = fixture.teacher;

    const passwordHash = await hashPassword(PASSWORD);
    await testPrisma.admin.update({ where: { id: adminB.id }, data: { passwordHash, mustChangePassword: false } });
    await testPrisma.teacher.update({ where: { id: teacherB.id }, data: { passwordHash, mustChangePassword: false } });
  });

  test.afterAll(async () => {
    await deleteTestInstitution(institutionBId);
  });

  test("B kurumunun yöneticisi, A kurumunun (seed) kayıtlarını NE doğrudan NE listeden göremez", async () => {
    const api = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" });

    const loginRes = await api.post("/api/auth/login", {
      data: { phone: adminB.institutionalMobile, password: PASSWORD, expectedRole: "principal" },
    });
    expect(loginRes.ok()).toBe(true);

    // Doğrudan erişim: A kurumunun seed öğretmenine id ile erişim 404 olmalı.
    const directRes = await api.get(`/api/teachers/${SEED_ACCOUNTS.teacher.id}`);
    expect(directRes.status()).toBe(404);

    // Liste erişimi: A kurumunun HİÇBİR kaydı, B yöneticisinin gördüğü
    // hiçbir listede görünmemeli.
    const directoryRes = await api.get("/api/admin/users/directory?role=TEACHER");
    expect(directoryRes.ok()).toBe(true);
    const directory = await directoryRes.json();
    expect(directory.teachers.some((t: { id: string }) => t.id === SEED_ACCOUNTS.teacher.id)).toBe(false);
    // B'nin KENDİ öğretmeni ise listede görünmeli — filtre "her şeyi
    // gizliyor" gibi yanlış bir pozitifle yeşil geçmesin diye.
    expect(directory.teachers.some((t: { id: string }) => t.id === teacherB.id)).toBe(true);

    const dashboardRes = await api.get("/api/admin/dashboard");
    expect(dashboardRes.ok()).toBe(true);
    const dashboard = await dashboardRes.json();
    const dashboardStudentIds: string[] = dashboard.students.map((s: { id: string }) => s.id);
    expect(dashboardStudentIds).not.toContain(SEED_ACCOUNTS.student.id);

    await api.dispose();
  });

  test("A kurumunun (seed) öğretmeni, B kurumunun kayıtlarına erişemez", async () => {
    const api = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" });

    const passwordHash = await hashPassword(PASSWORD);
    await testPrisma.teacher.update({ where: { id: SEED_ACCOUNTS.teacher.id }, data: { passwordHash, mustChangePassword: false } });

    const loginRes = await api.post("/api/auth/login", {
      data: { phone: SEED_ACCOUNTS.teacher.phone, password: PASSWORD, expectedRole: "teacher" },
    });
    expect(loginRes.ok()).toBe(true);

    const crossRes = await api.get(`/api/teachers/${teacherB.id}`);
    expect(crossRes.status()).toBe(404);

    // A'nın öğretmeni B kurumunun yönetici uçlarına da erişemez (rol +
    // kurum sınırı birlikte).
    const crossDashboardRes = await api.get("/api/admin/dashboard");
    expect(crossDashboardRes.status()).toBe(403);

    await testPrisma.teacher.update({ where: { id: SEED_ACCOUNTS.teacher.id }, data: { passwordHash: null, mustChangePassword: true } });
    await testPrisma.loginAttempt.deleteMany({ where: { phone: SEED_ACCOUNTS.teacher.phone.replace(/^0/, "") } });
    await api.dispose();
  });
});
