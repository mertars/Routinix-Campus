import { prisma } from "@/lib/server/prisma";
import { generateTemporaryPassword, hashPassword } from "@/lib/server/auth/generate-credentials";
import { generatePrefixedId } from "@/lib/server/ids";
import { generateStudentNumber, generateTeacherCode } from "@/lib/server/codes/institutional-codes";
import { findAccountByPhone } from "@/lib/server/auth/otp";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import type { AdminAuthorityLevel } from "@prisma/client";

// Tekli "Kullanıcı Ekle" modalı VE Toplu İçe Aktarma sihirbazı AYNI oluşturma
// mantığını paylaşır — iki farklı yerde iki farklı davranış riski olmasın.
export class AdminCreateError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export type CreatedAccount = { id: string; username: string; password: string; institutionalCode?: string };

export async function createStudentAccount(input: {
  institutionId: string;
  actorId: string;
  fullName: string;
  nationalId: string;
  branchId: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  healthNote?: string;
}): Promise<CreatedAccount> {
  const { firstName, lastName } = splitFullName(input.fullName);
  if (!lastName) throw new AdminCreateError("Ad ve soyadı birlikte girin.");
  if (!input.nationalId?.trim() || !input.branchId) {
    throw new AdminCreateError("T.C. No ve şube zorunludur.");
  }
  // Giriş ekranı telefon numarasıyla çalışır (bkz. app/login) — öğrencinin
  // kendi hattı yoksa (özellikle küçük yaş gruplarında) buraya velinin
  // numarası girilebilir; sistem SIM'in kime ait olduğunu denetlemez, sadece
  // bu numaranın bu öğrenci hesabına ait olduğunu bilir.
  if (!input.phone?.trim()) {
    throw new AdminCreateError("Öğrenci telefonu zorunludur (kişisel telefonu yoksa veli telefonu girilebilir).");
  }
  // Her öğrenci mutlaka bir veliye bağlanır — Veli Paneli'nin ve okul-veli
  // iletişiminin (SMS bildirimleri) tek gerçek kaynağı bu bağlantıdır.
  if (!input.parentName?.trim() || !input.parentPhone?.trim()) {
    throw new AdminCreateError("Veli adı ve veli telefonu zorunludur.");
  }

  // Şube başka bir kuruma aitse (client'tan gelen branchId manipüle edilmiş
  // olabilir) 404 — kurumun kendi şubesi dışında hiçbir şeyin varlığını bile
  // doğrulamaz.
  const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true, institutionId: true } });
  if (!branch || branch.institutionId !== input.institutionId) throw new AdminCreateError("Şube bulunamadı.", 404);

  const nationalIdTaken = await prisma.student.findUnique({ where: { nationalId: input.nationalId.trim() } });
  if (nationalIdTaken) throw new AdminCreateError("Bu T.C. No ile kayıtlı bir öğrenci zaten var.", 409);

  // Telefon numaraları (Teacher/Student/Admin/Parent, 4 farklı tabloda) DB
  // seviyesinde benzersiz zorlanmıyor — findAccountByPhone aynı numarayı
  // birden fazla hesapta ARAR ve tek (öncelik sıralı) bir sonuç döner; iki
  // hesap aynı numarayı paylaşırsa biri asla o numarayla giriş yapamaz. Bu
  // yüzden öğrencinin KENDİ telefonu (veli telefonu değil — o kardeş
  // paylaşımı için AŞAĞIDA ayrıca ele alınır) burada önceden denetlenir.
  const studentPhoneTaken = await findAccountByPhone(input.phone.trim());
  if (studentPhoneTaken) {
    throw new AdminCreateError("Bu telefon numarası ile kayıtlı başka bir hesap zaten var.", 409);
  }

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const student = await prisma.$transaction(async (tx) => {
    // Öğrenci No ("2026-1001" formatı) DAİMA otomatik üretilir — kısa
    // kurumsal kod aynı zamanda giriş kullanıcı adıdır, bu yüzden elle
    // girilebilir bir alan olarak bırakılmıyor (çakışma/uydurma riski).
    const studentNumber = await generateStudentNumber(tx, input.institutionId);
    const created = await tx.student.create({
      data: {
        id: generatePrefixedId("std"),
        institutionId: input.institutionId,
        nationalId: input.nationalId.trim(),
        firstName,
        lastName,
        studentNumber,
        branchId: input.branchId,
        phone: input.phone.trim(),
        healthNote: input.healthNote?.trim() || null,
        passwordHash,
      },
    });
    const parentPhone = input.parentPhone.trim();
    // Kardeşler aynı veliye bağlanmalı — aynı telefonla ikinci bir öğrenci
    // eklendiğinde YENİ bir Parent satırı değil, VAR OLANI kullanılır (aksi
    // halde aynı kişi için iki ayrı hesap oluşur ve giriş belirsizleşir).
    // Bu arama AYNI KURUM ile sınırlıdır — başka bir kurumdaki aynı numaralı
    // veli buradan asla eşleşmez (kurumlar arası veri karışmasın diye).
    const existingParent = await tx.parent.findFirst({ where: { mobilePhone: parentPhone, institutionId: input.institutionId } });
    if (!existingParent) {
      // Var olan bir veliye eşleşmedi — YENİ bir hesap oluşturulacak, bu
      // yüzden numaranın sistemde (herhangi bir kurumda, herhangi bir rolde)
      // BAŞKA bir hesaba ait olmadığı doğrulanır.
      const parentPhoneTaken = await findAccountByPhone(parentPhone);
      if (parentPhoneTaken) {
        throw new AdminCreateError("Veli telefonu başka bir hesaba (öğrenci/öğretmen/yönetici/veli) ait.", 409);
      }
    }
    const parent =
      existingParent ??
      (await (async () => {
        const { firstName: pFirst, lastName: pLast } = splitFullName(input.parentName);
        return tx.parent.create({
          data: {
            id: generatePrefixedId("prt"),
            institutionId: input.institutionId,
            firstName: pFirst,
            lastName: pLast || "Veli",
            relationship: "GUARDIAN",
            mobilePhone: parentPhone,
          },
        });
      })());
    await tx.parentStudent.create({ data: { parentId: parent.id, studentId: created.id } });
    return created;
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "USER_CREATED",
    targetType: "Student",
    targetId: student.id,
    metadata: { studentNumber: student.studentNumber, branchId: input.branchId },
  });

  return { id: student.id, username: student.studentNumber, password };
}

export async function createTeacherAccount(input: {
  institutionId: string;
  actorId: string;
  fullName: string;
  nationalId: string;
  subject: string;
  mobilePhone: string;
  email?: string;
  advisorBranchId?: string;
}): Promise<CreatedAccount> {
  const { firstName, lastName } = splitFullName(input.fullName);
  if (!lastName) throw new AdminCreateError("Ad ve soyadı birlikte girin.");
  if (!input.nationalId?.trim() || !input.subject?.trim() || !input.mobilePhone?.trim()) {
    throw new AdminCreateError("T.C. No, branş ve GSM zorunludur.");
  }

  const taken = await prisma.teacher.findUnique({ where: { nationalId: input.nationalId.trim() } });
  if (taken) throw new AdminCreateError("Bu T.C. No ile kayıtlı bir öğretmen zaten var.", 409);

  const phoneTaken = await findAccountByPhone(input.mobilePhone.trim());
  if (phoneTaken) throw new AdminCreateError("Bu telefon numarası ile kayıtlı başka bir hesap zaten var.", 409);

  if (input.advisorBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: input.advisorBranchId }, select: { id: true, institutionId: true } });
    if (!branch || branch.institutionId !== input.institutionId) throw new AdminCreateError("Danışman atanacak şube bulunamadı.", 404);
  }

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const teacher = await prisma.$transaction(async (tx) => {
    const institutionalCode = await generateTeacherCode(tx, input.institutionId);
    const created = await tx.teacher.create({
      data: {
        id: generatePrefixedId("tch"),
        institutionId: input.institutionId,
        nationalId: input.nationalId.trim(),
        firstName,
        lastName,
        subject: input.subject.trim(),
        mobilePhone: input.mobilePhone.trim(),
        institutionalEmail: input.email?.trim() || null,
        institutionalCode,
        passwordHash,
        ...(input.advisorBranchId ? { teachingBranches: { connect: { id: input.advisorBranchId } } } : {}),
      },
    });
    if (input.advisorBranchId) {
      await tx.branch.update({ where: { id: input.advisorBranchId }, data: { advisorId: created.id } });
    }
    return created;
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "USER_CREATED",
    targetType: "Teacher",
    targetId: teacher.id,
    metadata: { institutionalCode: teacher.institutionalCode, subject: input.subject },
  });

  return { id: teacher.id, username: teacher.nationalId, password, institutionalCode: teacher.institutionalCode ?? undefined };
}

export async function createAdminAccount(input: {
  institutionId: string;
  actorId: string;
  fullName: string;
  title: string;
  mobilePhone: string;
  email: string;
  authorityLevel?: AdminAuthorityLevel;
}): Promise<CreatedAccount> {
  const { firstName, lastName } = splitFullName(input.fullName);
  if (!lastName) throw new AdminCreateError("Ad ve soyadı birlikte girin.");
  if (!input.title?.trim() || !input.mobilePhone?.trim() || !input.email?.trim()) {
    throw new AdminCreateError("Unvan, GSM ve e-posta zorunludur.");
  }

  const taken = await prisma.admin.findFirst({ where: { email: input.email.trim() } });
  if (taken) throw new AdminCreateError("Bu e-posta ile kayıtlı bir yönetici zaten var.", 409);

  const phoneTaken = await findAccountByPhone(input.mobilePhone.trim());
  if (phoneTaken) throw new AdminCreateError("Bu telefon numarası ile kayıtlı başka bir hesap zaten var.", 409);

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const admin = await prisma.admin.create({
    data: {
      id: generatePrefixedId("adm"),
      institutionId: input.institutionId,
      firstName,
      lastName,
      title: input.title.trim(),
      institutionalMobile: input.mobilePhone.trim(),
      email: input.email.trim(),
      authorityLevel: input.authorityLevel ?? "BRANCH_MANAGER",
      passwordHash,
    },
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "USER_CREATED",
    targetType: "Admin",
    targetId: admin.id,
    metadata: { title: input.title },
  });

  return { id: admin.id, username: admin.email, password };
}
