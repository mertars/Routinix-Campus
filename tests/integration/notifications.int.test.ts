import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDb, testInstitutionId } from "@/lib/server/test-db";
import { UnscopedBulkWriteError } from "@/lib/server/db-guard";

// GERÇEK veritabanına karşı entegrasyon testi — ama CANLI dershane
// veritabanına DEĞİL (bkz. lib/server/test-db.ts ve docker-compose.test.yml).
//
// Bu dosyanın varlık sebebi: 236 birim testin hiçbiri veritabanına gitmiyordu,
// bu yüzden "Kaydet'e bastım hiçbir şey olmadı" türü hatalar ancak Mert
// fark edince ortaya çıkıyordu. Buradaki testler o boşluğu kapatır.

const db = testDb();
const institutionId = testInstitutionId("notif");
let teacherId = "";
let studentId = "";
let parentId = "";
let adminId = "";
let branchId = "";

beforeAll(async () => {
  await db.institution.create({
    data: { id: institutionId, name: `TEST Kurum ${institutionId}`, slug: institutionId },
  });
  const branch = await db.branch.create({
    data: { institutionId, name: "TEST-9A", grade: 9 },
  });
  branchId = branch.id;
  const teacher = await db.teacher.create({
    data: { institutionId, firstName: "Test", lastName: "Öğretmen", subject: "Matematik", nationalId: `T${Date.now()}`, mobilePhone: "05000000001" },
  });
  teacherId = teacher.id;
  const admin = await db.admin.create({
    data: { institutionId, firstName: "Test", lastName: "Yönetici", title: "Müdür", institutionalMobile: "05000000002", email: `a${Date.now()}@test.local` },
  });
  adminId = admin.id;
  const student = await db.student.create({
    data: { institutionId, branchId, firstName: "Test", lastName: "Öğrenci", nationalId: `S${Date.now()}`, studentNumber: `${Date.now()}` },
  });
  studentId = student.id;
  const parent = await db.parent.create({
    data: { institutionId, firstName: "Test", lastName: "Veli", relationship: "MOTHER", mobilePhone: "05000000003" },
  });
  parentId = parent.id;
  await db.parentStudent.create({ data: { parentId, studentId } });
});

afterAll(async () => {
  // Kurumu silmek yeter — ilişkiler cascade. Ve bu ID'ye göre silme,
  // yani db-guard'ın izin verdiği güvenli biçim.
  await db.institution.delete({ where: { id: institutionId } }).catch(() => {});
});

describe("bildirim yayımcısı (gerçek veritabanı)", () => {
  it("yoklama girilince yöneticiye ve devamsız öğrencinin velisine bildirim yazar", async () => {
    const { emitAttendanceNotifications } = await import("@/lib/server/notifications/emit-attendance");
    // notify() kendi içinde lib/server/prisma'yı kullanıyor; entegrasyon
    // testinde gerçek yazımı doğrulamak için aynı veritabanına bakıyoruz.
    await emitAttendanceNotifications({
      institutionId,
      teacherId,
      branchId,
      slot: "16:00-17:00",
      subject: "Matematik",
      records: [{ studentId, status: "ABSENT" }],
    });

    const adminNotifs = await db.activityNotification.findMany({
      where: { institutionId, recipientRole: "ADMIN", recipientId: adminId },
    });
    const parentNotifs = await db.activityNotification.findMany({
      where: { institutionId, recipientRole: "PARENT", recipientId: parentId },
    });

    expect(adminNotifs.length).toBeGreaterThan(0);
    expect(adminNotifs[0].title).toContain("yoklamasını girdi");
    expect(adminNotifs[0].category).toBe("ATTENDANCE");

    expect(parentNotifs.length).toBeGreaterThan(0);
    expect(parentNotifs[0].title).toContain("derse gelmedi");
    // Devamsızlık acil işaretli olmalı.
    expect(parentNotifs[0].urgent).toBe(true);
  });

  it("okunmamış sayacı kategori bazında doğru", async () => {
    const grouped = await db.activityNotification.groupBy({
      by: ["category"],
      where: { institutionId, isRead: false },
      _count: { _all: true },
    });
    const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
    expect(total).toBeGreaterThan(0);
    expect(grouped.every((g) => g.category === "ATTENDANCE")).toBe(true);
  });
});

describe("db-guard (gerçek veritabanı)", () => {
  it("sahiplik anahtarı olmayan toplu silmeyi GERÇEKTEN engeller ve hiçbir satır silinmez", async () => {
    const before = await db.activityNotification.count({ where: { institutionId } });
    expect(before).toBeGreaterThan(0);

    await expect(
      // 2026-09-14'teki hatanın birebir aynısı: içerik alanıyla silme.
      db.activityNotification.deleteMany({ where: { category: "ATTENDANCE" } })
    ).rejects.toThrow(UnscopedBulkWriteError);

    const after = await db.activityNotification.count({ where: { institutionId } });
    expect(after).toBe(before);
  });

  it("id ile silmeye izin verir", async () => {
    const row = await db.activityNotification.findFirst({ where: { institutionId }, select: { id: true } });
    const result = await db.activityNotification.deleteMany({ where: { id: row!.id } });
    expect(result.count).toBe(1);
  });
});
