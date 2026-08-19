import { prisma } from "@/lib/server/prisma";
import { generateTemporaryPassword, hashPassword } from "@/lib/server/auth/generate-credentials";
import { generatePrefixedId } from "@/lib/server/ids";
import { generateStudentNumber, generateTeacherCode } from "@/lib/server/codes/institutional-codes";
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
  fullName: string;
  nationalId: string;
  branchId: string;
  parentName?: string;
  parentPhone?: string;
  healthNote?: string;
}): Promise<CreatedAccount> {
  const { firstName, lastName } = splitFullName(input.fullName);
  if (!lastName) throw new AdminCreateError("Ad ve soyadı birlikte girin.");
  if (!input.nationalId?.trim() || !input.branchId) {
    throw new AdminCreateError("T.C. No ve şube zorunludur.");
  }

  const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
  if (!branch) throw new AdminCreateError("Şube bulunamadı.", 404);

  const nationalIdTaken = await prisma.student.findUnique({ where: { nationalId: input.nationalId.trim() } });
  if (nationalIdTaken) throw new AdminCreateError("Bu T.C. No ile kayıtlı bir öğrenci zaten var.", 409);

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const student = await prisma.$transaction(async (tx) => {
    // Öğrenci No ("2026-1001" formatı) DAİMA otomatik üretilir — kısa
    // kurumsal kod aynı zamanda giriş kullanıcı adıdır, bu yüzden elle
    // girilebilir bir alan olarak bırakılmıyor (çakışma/uydurma riski).
    const studentNumber = await generateStudentNumber(tx);
    const created = await tx.student.create({
      data: {
        id: generatePrefixedId("std"),
        nationalId: input.nationalId.trim(),
        firstName,
        lastName,
        studentNumber,
        branchId: input.branchId,
        healthNote: input.healthNote?.trim() || null,
        passwordHash,
      },
    });
    if (input.parentName?.trim() && input.parentPhone?.trim()) {
      const { firstName: pFirst, lastName: pLast } = splitFullName(input.parentName);
      const parent = await tx.parent.create({
        data: { id: generatePrefixedId("prt"), firstName: pFirst, lastName: pLast || "Veli", relationship: "GUARDIAN", mobilePhone: input.parentPhone.trim() },
      });
      await tx.parentStudent.create({ data: { parentId: parent.id, studentId: created.id } });
    }
    return created;
  });

  return { id: student.id, username: student.studentNumber, password };
}

export async function createTeacherAccount(input: {
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

  if (input.advisorBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: input.advisorBranchId }, select: { id: true } });
    if (!branch) throw new AdminCreateError("Danışman atanacak şube bulunamadı.", 404);
  }

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const teacher = await prisma.$transaction(async (tx) => {
    const institutionalCode = await generateTeacherCode(tx);
    const created = await tx.teacher.create({
      data: {
        id: generatePrefixedId("tch"),
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

  return { id: teacher.id, username: teacher.nationalId, password, institutionalCode: teacher.institutionalCode ?? undefined };
}

export async function createAdminAccount(input: {
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

  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  const admin = await prisma.admin.create({
    data: {
      id: generatePrefixedId("adm"),
      firstName,
      lastName,
      title: input.title.trim(),
      institutionalMobile: input.mobilePhone.trim(),
      email: input.email.trim(),
      authorityLevel: input.authorityLevel ?? "BRANCH_MANAGER",
      passwordHash,
    },
  });

  return { id: admin.id, username: admin.email, password };
}
