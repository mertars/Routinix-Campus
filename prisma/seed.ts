// Demo verisi tohumlama scripti — `npx prisma db seed` (veya `npm run db:seed`)
// ile çalışır (bkz. prisma.config.ts > migrations.seed).
//
// TÜM şube ve öğrenci rosterlarını lib/mock-data.ts'teki INITIAL_BRANCHES /
// SEAT_ROSTER_BY_BRANCH'ten üretir — bu sayede frontend'in HER YERDE (sınav
// oturma planı, optik tarayıcı, vb.) kullandığı sabit mock ID'ler gerçek
// Postgres satırlarıyla BİREBİR eşleşir; aynı öğrenci hem migrate edilmiş
// modüllerde (Yoklama/Ödev/Pop-Quiz) hem henüz mock kalan modüllerde aynı
// kişi olarak görünür.
//
// ⚠️ passwordHash alanları, TÜM demo hesaplar için aynı, açıkça sahte bir
// demo şifresinin ("Demo1234!") bcrypt hash'idir — gerçek bir kimlik bilgisi
// değildir. Gerçek bir giriş (login) akışı henüz uygulanmadı; bu alan sadece
// ileride eklenecek auth için altyapı hazırlığıdır.
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import {
  INITIAL_BRANCHES,
  SEAT_ROSTER_BY_BRANCH,
  STAFF,
  INITIAL_STUDENT_REPORTS,
  INITIAL_SCHEDULE,
  TEACHER_DUTY_SLOTS,
  TEACHER_UNAVAILABLE,
  INITIAL_REMEDIATION_TASKS,
} from "../lib/mock-data";
import { generateBranchCode, generateTeacherCode, generateStudentNumber } from "../lib/server/codes/institutional-codes";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD_HASH = bcrypt.hashSync("Demo1234!", 10);

const TEACHER_ID_BY_NAME: Record<string, string> = {
  "İrfan Hoca": "1",
  "Selin Hoca": "2",
  "Kemal Hoca": "3",
  "Ayşe Hoca": "4",
  "Zehra Rehber": "5",
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "Öğrenci" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

// seat.id'den KARARLI (deterministik) bir sahte TC No üretir — roster
// kompozisyonu/sırası ileride değişse bile (örn. yeni bilinen isim eklense)
// script'i tekrar çalıştırmak nationalId çakışmasına yol açmaz; çalışan bir
// sıra indeksine göre değil, doğrudan seat.id'nin kendisine göre türer.
function nationalIdFor(seatId: string): string {
  const hash = createHash("sha256").update(seatId).digest("hex");
  const numeric = BigInt(`0x${hash.slice(0, 12)}`) % BigInt(1_000_000_000);
  return `9${numeric.toString().padStart(9, "0")}`;
}

async function main() {
  // ---- Öğretmenler -----------------------------------------------------
  const teachers = [
    { id: "1", firstName: "İrfan", lastName: "Hoca", subject: "Matematik", nationalId: "10000000001", mobilePhone: "05550000001" },
    { id: "2", firstName: "Selin", lastName: "Hoca", subject: "Türkçe", nationalId: "10000000002", mobilePhone: "05550000002" },
    { id: "3", firstName: "Kemal", lastName: "Hoca", subject: "Fizik", nationalId: "10000000003", mobilePhone: "05550000003" },
    { id: "4", firstName: "Ayşe", lastName: "Hoca", subject: "LGS Branş", nationalId: "10000000004", mobilePhone: "05550000004" },
    { id: "5", firstName: "Zehra", lastName: "Rehber", subject: "Rehberlik", nationalId: "10000000005", mobilePhone: "05550000005" },
  ];
  for (const teacher of teachers) {
    await prisma.teacher.upsert({
      where: { id: teacher.id },
      update: {},
      create: { ...teacher, passwordHash: DEMO_PASSWORD_HASH, institutionalEmail: `${teacher.firstName.toLowerCase()}@arslandershaneleri.demo` },
    });
  }

  // ---- Yönetici (Müdür) ------------------------------------------------
  await prisma.admin.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      firstName: "Mert",
      lastName: "Yönetici",
      title: "Kurum Müdürü",
      authorityLevel: "SUPER_ADMIN",
      institutionalMobile: "05550000000",
      email: "mudur@arslandershaneleri.demo",
      passwordHash: DEMO_PASSWORD_HASH,
    },
  });

  // ---- Şubeler & tam rosterlar ------------------------------------------
  // "Mezun" (MEZUN kademesi) sınıf seviyesi taşımaz — Prisma şeması Branch.grade'i
  // zorunlu tuttuğu için burada temsili olarak 12 kullanıyoruz.
  const studentIdsByBranch: Record<string, string[]> = {};

  for (const mockBranch of INITIAL_BRANCHES) {
    const teacherId = TEACHER_ID_BY_NAME[mockBranch.teacher];
    // Branch.id BİLEREK mock branch.id ile aynı — frontend'in her yerde
    // kullandığı INITIAL_BRANCHES id'leri (örn. "12a"), Teacher/Student'ta
    // olduğu gibi, doğrudan gerçek Postgres satırına karşılık gelsin diye.
    const branch = await prisma.branch.upsert({
      where: { id: mockBranch.id },
      update: { segment: mockBranch.segment },
      create: { id: mockBranch.id, name: mockBranch.name, grade: mockBranch.grade ?? 12, segment: mockBranch.segment, advisorId: teacherId },
    });
    const roster = SEAT_ROSTER_BY_BRANCH[mockBranch.id] ?? [];
    const createdIds: string[] = [];
    for (let i = 0; i < roster.length; i++) {
      const seat = roster[i];
      const { firstName, lastName } = splitName(seat.name);
      const ageYears = 6 + (mockBranch.grade ?? 18);
      const birthYear = 2026 - ageYears;
      await prisma.student.upsert({
        where: { id: seat.id },
        update: {},
        create: {
          id: seat.id,
          nationalId: nationalIdFor(seat.id),
          firstName,
          lastName,
          birthDate: new Date(birthYear, 0, 15),
          gender: i % 2 === 0 ? "MALE" : "FEMALE",
          studentNumber: `S-${seat.id}`,
          branchId: branch.id,
          advisorTeacherId: teacherId,
          passwordHash: DEMO_PASSWORD_HASH,
        },
      });
      createdIds.push(seat.id);
    }
    studentIdsByBranch[mockBranch.id] = createdIds;
  }

  // ---- Zenginleştirilmiş demo öğrenci: Arslan Yıldırım (id "1") --------
  await prisma.student.update({
    where: { id: "1" },
    data: { email: "arslan.yildirim@ogrenci.demo" },
  });

  // ---- Veli & Öğrenci-Veli ilişkisi (Arslan'ın velisi) ------------------
  const parent = await prisma.parent.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      firstName: "Kemal",
      lastName: "Yıldırım",
      relationship: "FATHER",
      mobilePhone: "05551110000",
      smsConsent: true,
      kvkkConsent: "GRANTED",
      iysConsent: "GRANTED",
      passwordHash: DEMO_PASSWORD_HASH,
      email: "kemal.yildirim@veli.demo",
    },
  });
  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId: "1" } },
    update: {},
    create: { parentId: parent.id, studentId: "1" },
  });

  // ---- Deneme sınavı net sonuçları (12-A VIP: Arslan "1" + Cem "3") -----
  const examNames = ["YKS Genel Deneme-1", "YKS Genel Deneme-2", "YKS Genel Deneme-3", "YKS Genel Deneme-4"];
  const arslanNets = [32, 35, 34, 38];
  const cemNets = [20, 18, 16, 15];
  const adaNets = [24, 27, 29, 31]; // 11-A Fen, id "4"
  for (let i = 0; i < examNames.length; i++) {
    const exam = await prisma.exam.upsert({
      where: { id: `exam-${i + 1}` },
      update: {},
      create: { id: `exam-${i + 1}`, name: examNames[i], examDate: new Date(2026, 3, (i + 1) * 7) },
    });
    for (const [studentId, nets] of [
      ["1", arslanNets],
      ["3", cemNets],
      ["4", adaNets],
    ] as const) {
      await prisma.examNetResult.upsert({
        where: { examId_studentId_subject: { examId: exam.id, studentId, subject: "Matematik" } },
        update: {},
        create: { examId: exam.id, studentId, subject: "Matematik", net: nets[i] },
      });
    }
  }

  // ---- Yoklama kayıtları (Arslan) --------------------------------------
  const attendanceStatuses: { daysAgo: number; status: string }[] = [
    { daysAgo: 1, status: "PRESENT" },
    { daysAgo: 2, status: "PRESENT" },
    { daysAgo: 3, status: "LATE" },
    { daysAgo: 4, status: "PRESENT" },
    { daysAgo: 7, status: "ABSENT" },
  ];
  for (const { daysAgo, status } of attendanceStatuses) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);
    await prisma.attendanceRecord.upsert({
      where: { studentId_date: { studentId: "1", date } },
      update: { status },
      create: { studentId: "1", date, status },
    });
  }

  // ---- Öğretmen ↔ Şube "ders veriyor" ilişkisi (STAFF.branches'ten) -----
  // Danışmanlıktan (Branch.advisorId, tek öğretmen) BAĞIMSIZ: bir öğretmen
  // birden fazla şubede ders verebilir. "Tüm Şubeler" (Zehra Rehber/rehberlik
  // uzmanı) tüm şubelere bağlanır.
  const branchNameToId = new Map(INITIAL_BRANCHES.map((b) => [b.name, b.id]));
  for (const staff of STAFF) {
    const teacherId = TEACHER_ID_BY_NAME[staff.name];
    if (!teacherId) continue;
    const branchIds = staff.branches.includes("Tüm Şubeler")
      ? INITIAL_BRANCHES.map((b) => b.id)
      : staff.branches.map((name) => branchNameToId.get(name)).filter((id): id is string => !!id);
    await prisma.teacher.update({
      where: { id: teacherId },
      data: { teachingBranches: { set: branchIds.map((id) => ({ id })) } },
    });
  }

  // ---- Hedef net & haftalık çalışma saati (INITIAL_STUDENT_REPORTS'tan) --
  // Sadece o mock raporda zenginleştirilmiş demo öğrenciler için — diğerleri
  // null kalır (Röntgen ekranından öğretmen tarafından girilir).
  for (const report of INITIAL_STUDENT_REPORTS) {
    await prisma.student.updateMany({
      where: { id: report.id },
      data: { targetNet: report.targetNet, weeklyStudyHours: report.studyHours },
    });
  }

  // ---- Ana haftalık ders programı (Çakışmasız Ders Programı) ------------
  for (const row of INITIAL_SCHEDULE) {
    const teacherId = TEACHER_ID_BY_NAME[row.teacherName];
    if (!teacherId) continue;
    await prisma.lessonSlot.upsert({
      where: { branchId_day_slot: { branchId: row.branchId, day: row.day, slot: row.slot } },
      update: { teacherId, subject: row.subject },
      create: { branchId: row.branchId, day: row.day, slot: row.slot, teacherId, subject: row.subject },
    });
  }

  // ---- Nöbet saatleri -----------------------------------------------------
  for (const duty of TEACHER_DUTY_SLOTS) {
    const teacherId = TEACHER_ID_BY_NAME[duty.teacherName];
    if (!teacherId) continue;
    const existing = await prisma.teacherDutySlot.findFirst({ where: { teacherId, day: duty.day, slot: duty.slot } });
    if (!existing) {
      await prisma.teacherDutySlot.create({ data: { teacherId, day: duty.day, slot: duty.slot, label: duty.label } });
    }
  }

  // ---- Öğretmenin müsait olmadığı saatler (ders programı çakışma kontrolü
  // ve etüt talebi engelleme aynı gerçek tabloyu paylaşır) -----------------
  for (const block of TEACHER_UNAVAILABLE) {
    const teacherId = TEACHER_ID_BY_NAME[block.teacherName];
    if (!teacherId) continue;
    await prisma.teacherUnavailability.upsert({
      where: { teacherId_day_slot: { teacherId, day: block.day, slot: block.slot } },
      update: {},
      create: { teacherId, day: block.day, slot: block.slot },
    });
  }

  // ---- Eksik Kapatma görevleri (INITIAL_REMEDIATION_TASKS'tan) ----------
  const allStudents = await prisma.student.findMany({ select: { id: true, firstName: true, lastName: true } });
  for (const task of INITIAL_REMEDIATION_TASKS) {
    const student = allStudents.find((s) => `${s.firstName} ${s.lastName}` === task.studentName);
    if (!student) continue;
    const existing = await prisma.remediationTask.findFirst({ where: { studentId: student.id, topic: task.topic } });
    if (!existing) {
      await prisma.remediationTask.create({ data: { studentId: student.id, topic: task.topic, taskDescription: task.taskDescription } });
    }
  }

  // ---- Kurumsal kodlar (RTX-IST01, TCH-101, 2026-1001) --------------------
  // Sadece kodu HENÜZ olmayan kayıtlara atanır — script tekrar çalıştırılınca
  // (upsert'ler "update: {}" olduğu için) zaten kodlu kayıtlara yeni kod
  // üretilmez, sıra numarası her seferinde 01'den şaşmaz.
  const branchesWithoutCode = await prisma.branch.findMany({ where: { institutionalCode: null }, orderBy: { grade: "asc" } });
  for (const branch of branchesWithoutCode) {
    const code = await generateBranchCode(prisma);
    await prisma.branch.update({ where: { id: branch.id }, data: { institutionalCode: code } });
  }

  const teachersWithoutCode = await prisma.teacher.findMany({ where: { institutionalCode: null }, orderBy: { id: "asc" } });
  for (const teacher of teachersWithoutCode) {
    const code = await generateTeacherCode(prisma);
    await prisma.teacher.update({ where: { id: teacher.id }, data: { institutionalCode: code } });
  }

  // Eski "S-{seatId}" formatındaki öğrenci no'ları yeni "{yıl}-{sıra}" insan-
  // okur kurumsal koduna çevirir (bkz. lib/server/codes/institutional-codes.ts).
  const studentsWithOldFormat = await prisma.student.findMany({
    where: { studentNumber: { startsWith: "S-" } },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  for (const student of studentsWithOldFormat) {
    const studentNumber = await generateStudentNumber(prisma);
    await prisma.student.update({ where: { id: student.id }, data: { studentNumber } });
  }

  const totalStudents = Object.values(studentIdsByBranch).reduce((sum, ids) => sum + ids.length, 0);
  console.log(
    `Seed tamamlandı: ${INITIAL_BRANCHES.length} şube, ${teachers.length} öğretmen, 1 yönetici, ${totalStudents} öğrenci, 1 veli, 12 net sonucu, 5 yoklama kaydı.`
  );
  console.log(`Demo giriş şifresi (tüm hesaplar için, henüz login akışı yok): "Demo1234!"`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
