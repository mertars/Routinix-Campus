import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// e2e testleri kendi Prisma bağlantısını kurar (lib/server/prisma.ts'i
// İTHAL ETMEZ) — o modül next/headers gibi Next.js'e özgü importlar
// zincirine bağlı olabilecek diğer sunucu modüllerini de beraberinde
// getirebilir; burada sadece ham bir DB bağlantısı gerekiyor.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
export const testPrisma = new PrismaClient({ adapter });

// Testler prisma/seed.ts'teki DETERMİNİSTİK demo hesaplarını kullanır —
// bkz. orada tanımlı sabit id'ler/telefonlar.
export const SEED_ACCOUNTS = {
  teacher: { id: "1", phone: "05550000001", role: "teacher" as const },
  student: { id: "1", phone: "05555437125", role: "student" as const },
  admin: { id: "1", phone: "05550000000", role: "principal" as const },
  parent: { id: "1", phone: "05551110000", role: "parent" as const },
};

// Bir hesabı "hiç şifre belirlenmemiş" (ilk giriş) durumuna sıfırlar —
// OTP akışı testlerinin başlangıç noktasıdır.
export async function resetToFirstLogin(model: "teacher" | "student" | "admin" | "parent", id: string) {
  const data = { passwordHash: null, mustChangePassword: true };
  if (model === "teacher") await testPrisma.teacher.update({ where: { id }, data });
  else if (model === "student") await testPrisma.student.update({ where: { id }, data });
  else if (model === "admin") await testPrisma.admin.update({ where: { id }, data });
  else await testPrisma.parent.update({ where: { id }, data });
}

// Bir hesaba, doğrudan (OTP akışından geçmeden) bilinen bir şifre atar —
// şifre-tabanlı giriş/lockout testlerinin başlangıç noktasıdır.
export async function setKnownPassword(model: "teacher" | "student" | "admin" | "parent", id: string, passwordHash: string) {
  const data = { passwordHash, mustChangePassword: false };
  if (model === "teacher") await testPrisma.teacher.update({ where: { id }, data });
  else if (model === "student") await testPrisma.student.update({ where: { id }, data });
  else if (model === "admin") await testPrisma.admin.update({ where: { id }, data });
  else await testPrisma.parent.update({ where: { id }, data });
}

export async function clearLoginState(phone: string) {
  const normalized = phone.replace(/^0/, "");
  await testPrisma.loginAttempt.deleteMany({ where: { phone: normalized } });
  await testPrisma.otpCode.deleteMany({ where: { phone: normalized } });
}

// Kurumlar-arası izolasyon smoke testleri için, seed'deki tek kurumdan
// (Arslan Dershaneleri) tamamen BAĞIMSIZ, geçici bir ikinci kurum + bir
// yönetici + bir öğretmen kurar. onboard-institution.ts script'iyle AYNI
// veri şeklini üretir ama test hızı için doğrudan Prisma ile.
export async function createTestInstitutionWithAccounts(labelPrefix: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const institution = await testPrisma.institution.create({
    data: { name: `${labelPrefix} ${suffix}`, slug: `${labelPrefix.toLowerCase()}-${suffix}`, isActive: true },
  });
  const admin = await testPrisma.admin.create({
    data: {
      id: `test_adm_${suffix}`,
      institutionId: institution.id,
      firstName: "Test",
      lastName: "Yönetici",
      title: "Kurum Müdürü",
      authorityLevel: "SUPER_ADMIN",
      institutionalMobile: `05559${suffix.replace(/\D/g, "").slice(0, 6).padEnd(6, "0")}`,
      email: `test-admin-${suffix}@isolation-test.demo`,
      passwordHash: null,
      mustChangePassword: true,
    },
  });
  const teacher = await testPrisma.teacher.create({
    data: {
      id: `test_tch_${suffix}`,
      institutionId: institution.id,
      firstName: "Test",
      lastName: "Öğretmen",
      subject: "Matematik",
      nationalId: `9${suffix.replace(/\D/g, "").padEnd(10, "0").slice(0, 10)}`,
      mobilePhone: `05558${suffix.replace(/\D/g, "").slice(0, 6).padEnd(6, "0")}`,
      passwordHash: null,
      mustChangePassword: true,
    },
  });
  return { institution, admin, teacher };
}

// Yukarıdaki fixture'ı ve YARATTIĞI her şeyi (kurum dahil) kalıcı olarak
// siler — testler kendi arkalarını temizler, gerçek/demo veriye asla
// dokunmaz.
export async function deleteTestInstitution(institutionId: string) {
  const [admins, teachers] = await Promise.all([
    testPrisma.admin.findMany({ where: { institutionId }, select: { institutionalMobile: true } }),
    testPrisma.teacher.findMany({ where: { institutionId }, select: { mobilePhone: true } }),
  ]);
  const phones = [...admins.map((a) => a.institutionalMobile), ...teachers.map((t) => t.mobilePhone)];
  if (phones.length > 0) {
    await testPrisma.loginAttempt.deleteMany({ where: { phone: { in: phones.map((p) => p.replace(/^0/, "")) } } });
  }
  // AuditLog.institutionId onDelete: Restrict — kurum silinmeden önce
  // temizlenmezse (örn. bu fixture'la bir kullanıcı oluşturma/şifre
  // değişimi tetiklenirse) Institution.delete() bir FK ihlaliyle patlar.
  await testPrisma.auditLog.deleteMany({ where: { institutionId } });
  await testPrisma.parentStudent.deleteMany({ where: { student: { institutionId } } });
  await testPrisma.student.deleteMany({ where: { institutionId } });
  await testPrisma.teacher.deleteMany({ where: { institutionId } });
  await testPrisma.parent.deleteMany({ where: { institutionId } });
  await testPrisma.admin.deleteMany({ where: { institutionId } });
  await testPrisma.branch.deleteMany({ where: { institutionId } });
  await testPrisma.institution.delete({ where: { id: institutionId } });
}
