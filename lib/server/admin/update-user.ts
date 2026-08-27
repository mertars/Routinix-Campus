import { prisma } from "@/lib/server/prisma";
import { AdminCreateError, splitFullName } from "@/lib/server/admin/create-user";
import { findAccountByPhone } from "@/lib/server/auth/otp";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { generateTemporaryPassword, hashPassword } from "@/lib/server/auth/generate-credentials";

// Toplu içe aktarma (bkz. app/api/admin/import/bulk) veya tekli ekleme
// sırasında girilen bir bilgi hatalıysa (yanlış telefon, yanlış şube vb.)
// düzeltmenin TEK yolu buydu: kaydı silip yeniden oluşturmak — bu da
// giriş bilgilerini (kullanıcı adı/şifre) sıfırlardı. Bu dosya, KİMLİK
// BİLGİLERİNE (şifre, giriş yöntemi) DOKUNMADAN sadece temel bilgileri
// güncelleyen dar kapsamlı bir düzenleme yolu sağlar.

export async function getEditableStudent(id: string, institutionId: string) {
  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, institutionId: true, firstName: true, lastName: true, branchId: true, phone: true, healthNote: true },
  });
  if (!student || student.institutionId !== institutionId) throw new AdminCreateError("Öğrenci bulunamadı.", 404);
  return student;
}

export async function getEditableTeacher(id: string, institutionId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    select: {
      id: true,
      institutionId: true,
      firstName: true,
      lastName: true,
      subject: true,
      mobilePhone: true,
      institutionalEmail: true,
      teachingBranches: { select: { id: true } },
    },
  });
  if (!teacher || teacher.institutionId !== institutionId) throw new AdminCreateError("Öğretmen bulunamadı.", 404);
  return teacher;
}

export async function updateStudentAccount(input: {
  id: string;
  institutionId: string;
  actorId: string;
  fullName: string;
  branchId: string;
  phone: string;
  healthNote?: string;
}): Promise<void> {
  const existing = await getEditableStudent(input.id, input.institutionId);

  const { firstName, lastName } = splitFullName(input.fullName);
  if (!lastName) throw new AdminCreateError("Ad ve soyadı birlikte girin.");
  if (!input.branchId) throw new AdminCreateError("Şube zorunludur.");
  if (!input.phone?.trim()) throw new AdminCreateError("Öğrenci telefonu zorunludur.");

  const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true, institutionId: true } });
  if (!branch || branch.institutionId !== input.institutionId) throw new AdminCreateError("Şube bulunamadı.", 404);

  const phone = input.phone.trim();
  if (phone !== existing.phone) {
    const phoneTaken = await findAccountByPhone(phone);
    if (phoneTaken) throw new AdminCreateError("Bu telefon numarası ile kayıtlı başka bir hesap zaten var.", 409);
  }

  await prisma.student.update({
    where: { id: input.id },
    data: { firstName, lastName, branchId: input.branchId, phone, healthNote: input.healthNote?.trim() || null },
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "USER_UPDATED",
    targetType: "Student",
    targetId: input.id,
    metadata: { branchId: input.branchId },
  });
}

export async function updateTeacherAccount(input: {
  id: string;
  institutionId: string;
  actorId: string;
  fullName: string;
  subject: string;
  mobilePhone: string;
  email?: string;
  advisorBranchId?: string;
}): Promise<void> {
  const existing = await getEditableTeacher(input.id, input.institutionId);

  const { firstName, lastName } = splitFullName(input.fullName);
  if (!lastName) throw new AdminCreateError("Ad ve soyadı birlikte girin.");
  if (!input.subject?.trim() || !input.mobilePhone?.trim()) throw new AdminCreateError("Branş ve GSM zorunludur.");

  const mobilePhone = input.mobilePhone.trim();
  if (mobilePhone !== existing.mobilePhone) {
    const phoneTaken = await findAccountByPhone(mobilePhone);
    if (phoneTaken) throw new AdminCreateError("Bu telefon numarası ile kayıtlı başka bir hesap zaten var.", 409);
  }

  if (input.advisorBranchId) {
    const branch = await prisma.branch.findUnique({ where: { id: input.advisorBranchId }, select: { id: true, institutionId: true } });
    if (!branch || branch.institutionId !== input.institutionId) throw new AdminCreateError("Danışman atanacak şube bulunamadı.", 404);
  }

  const previousAdvisorBranchId = existing.teachingBranches[0]?.id;

  const branchChanged = input.advisorBranchId !== previousAdvisorBranchId;

  await prisma.$transaction(async (tx) => {
    await tx.teacher.update({
      where: { id: input.id },
      data: {
        firstName,
        lastName,
        subject: input.subject.trim(),
        mobilePhone,
        institutionalEmail: input.email?.trim() || null,
        // ⚠️ disconnect/connect AYNI teachingBranches objesinin içinde
        // birlikte verilmeli — iki AYRI "teachingBranches: {...}" spread'i
        // (önceki sürümdeki hata) ikinci objenin birinciyi TAMAMEN
        // ezmesine yol açıyordu, disconnect sessizce kayboluyordu (canlı
        // testte doğrulandı: öğretmen hem eski hem yeni şubede danışman
        // gibi görünmeye devam ediyordu).
        ...(branchChanged
          ? {
              teachingBranches: {
                ...(previousAdvisorBranchId ? { disconnect: { id: previousAdvisorBranchId } } : {}),
                ...(input.advisorBranchId ? { connect: { id: input.advisorBranchId } } : {}),
              },
            }
          : {}),
      },
    });
    if (previousAdvisorBranchId && previousAdvisorBranchId !== input.advisorBranchId) {
      await tx.branch.update({ where: { id: previousAdvisorBranchId }, data: { advisorId: null } });
    }
    if (input.advisorBranchId && input.advisorBranchId !== previousAdvisorBranchId) {
      await tx.branch.update({ where: { id: input.advisorBranchId }, data: { advisorId: input.id } });
    }
  });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "USER_UPDATED",
    targetType: "Teacher",
    targetId: input.id,
    metadata: { subject: input.subject },
  });
}

export type ResetPasswordResult = { name: string; username: string; password: string; phone?: string; institutionalCode?: string };

// Şifre hash'i (bcrypt) tek yönlü — kayıt oluşturulurken üretilen geçici
// şifre bir kez gösterildikten sonra HİÇBİR yerde (DB dahil) düz metin
// olarak tutulmaz, tekrar görüntülenemez. Ekran kapatılıp not alınmadıysa
// tek çözüm YENİ bir geçici şifre üretmektir — bu da mustChangePassword'ü
// tekrar true'ya çeker, tıpkı ilk oluşturmada olduğu gibi.
export async function resetUserPassword(input: {
  id: string;
  role: "STUDENT" | "TEACHER";
  institutionId: string;
  actorId: string;
}): Promise<ResetPasswordResult> {
  const password = generateTemporaryPassword();
  const passwordHash = await hashPassword(password);

  if (input.role === "STUDENT") {
    const existing = await prisma.student.findUnique({
      where: { id: input.id },
      select: { institutionId: true, firstName: true, lastName: true, studentNumber: true, phone: true },
    });
    if (!existing || existing.institutionId !== input.institutionId) throw new AdminCreateError("Öğrenci bulunamadı.", 404);

    await prisma.student.update({ where: { id: input.id }, data: { passwordHash, mustChangePassword: true } });

    await recordAuditLog({
      institutionId: input.institutionId,
      actorId: input.actorId,
      actorRole: "ADMIN",
      action: "PASSWORD_RESET_BY_ADMIN",
      targetType: "Student",
      targetId: input.id,
    });

    return { name: `${existing.firstName} ${existing.lastName}`, username: existing.studentNumber, password, phone: existing.phone ?? undefined };
  }

  const existing = await prisma.teacher.findUnique({
    where: { id: input.id },
    select: { institutionId: true, firstName: true, lastName: true, nationalId: true, mobilePhone: true, institutionalCode: true },
  });
  if (!existing || existing.institutionId !== input.institutionId) throw new AdminCreateError("Öğretmen bulunamadı.", 404);

  await prisma.teacher.update({ where: { id: input.id }, data: { passwordHash, mustChangePassword: true } });

  await recordAuditLog({
    institutionId: input.institutionId,
    actorId: input.actorId,
    actorRole: "ADMIN",
    action: "PASSWORD_RESET_BY_ADMIN",
    targetType: "Teacher",
    targetId: input.id,
  });

  return {
    name: `${existing.firstName} ${existing.lastName}`,
    username: existing.nationalId,
    password,
    phone: existing.mobilePhone,
    institutionalCode: existing.institutionalCode ?? undefined,
  };
}
